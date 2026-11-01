const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('./helpers/load');
const M = loadModules();
const { parseQuery, parseExpression, flatten, canonicalKey, makeSolver, solveQuery, buildLinearModel, findContextProblem,
  computeMinterms, collectAtoms, consistencyWarnings, fmtNum } = M;

const k = s => canonicalKey(flatten(parseExpression(s)));
const ctxOf = (pairs, extra) => Object.assign({ knownProb: new Map(pairs), independentGroups: [], mutexPairs: new Set(), partition: null }, extra || {});
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);
const q = s => flatten(parseQuery(s).arg);

// ---------------------------------------------------------------- rules
test('rule solver: inclusion-exclusion, complement, independence, conditional, total probability, Bayes', () => {
  const run = (s, ctx) => makeSolver().solve(q(s), ctx, null).numeric;
  near(run('P(A U B)', ctxOf([[k('A'), .5], [k('B'), .4], [k('A n B'), .1]])), .8);
  near(run("P(A')", ctxOf([[k('A'), .3]])), .7);
  near(run('P(A n B)', ctxOf([[k('A'), .5], [k('B'), .4]], { independentGroups: [new Set([k('A'), k('B')])] })), .2);
  near(run('P(B|A)', ctxOf([[k('A'), .5], [k('A n B'), .2]])), .4);
  const ltp = ctxOf([[k('B1'), .3], [k('B2'), .5], [k('B3'), .2], ['A|B1', .1], ['A|B2', .2], ['A|B3', .05]], { partition: ['B1', 'B2', 'B3'] });
  near(run('P(A)', ltp), .14);
  near(run('P(B1|A)', ltp), .03 / .14);
  near(run('P(A U B U C)', ctxOf([[k('A'), .3], [k('B'), .4], [k('C'), .5], [k('A n B'), .1], [k('A n C'), .15], [k('B n C'), .2], [k('A n B n C'), .05]])), .8);
});

test('rule solver: reported 4-set case with facts only reachable through compound conditionals -> 0.88', () => {
  const ctx = ctxOf([
    [k('A'), .3], [k('B'), .3], [k('C'), .4], [k('D'), .4],
    [k('A n B'), .1], [k('A n C'), .1], [k('A n D'), .1], [k('B n C'), .1], [k('B n D'), .1],
    ['C|D', .375], [k('A n B n C'), .03], [k('A n B n D'), .03],
    ['(C∩D)|A', 2 / 15], ['D|(B∩C)', .4], [k('A n B n C n D'), .01],
  ]);
  const r = makeSolver().solve(q('P(A U B U C U D)'), ctx, null);
  near(r.numeric, .88, 1e-9);
});

test('rule solver: a subtracted sub-expression that stays symbolic is parenthesized, not sign-flattened', () => {
  // P(B∩C) and P(A∩B∩C) unknown, so the union cannot close; the displayed
  // formula must read  ... - (0.1 + 0.15 - P(A∩B∩C))  not  ... - 0.1 + 0.15 - ...
  const ctx = ctxOf([[k('A'), .3], [k('B'), .4], [k('C'), .5], [k('A n B'), .1], [k('A n C'), .15]]);
  const r = makeSolver().solve(q('P(A U B U C)'), ctx, null);
  assert.equal(r.numeric, null);
  assert.match(r.latex, /- \\left\(0\.1 \+ 0\.15 - P/);
});

// ---------------------------------------------------------------- linear
test('linear: inverse inference — P(A∩B) from P(A), P(B), P(A∪B)', () => {
  const ctx = ctxOf([[k('A'), .5], [k('B'), .6], [k('A U B'), .8]]);
  // the rule solver alone cannot run inclusion-exclusion backwards
  assert.equal(makeSolver().solve(q('P(A n B)'), ctx, null).numeric, null);
  const out = solveQuery(q('P(A n B)'), ctx, null);
  near(out.numeric, .3);
  assert.equal(out.via, 'linear');
  assert.match(out.steps[0].eq, /= 0\.5 \+ 0\.6 - 0\.8 = 0\.3$/);
});

test('linear: other inverse problems', () => {
  near(solveQuery(q('P(A)'), ctxOf([[k('B'), .6], [k('A U B'), .8], [k('A n B'), .3]]), null).numeric, .5);
  near(solveQuery(q("P(A' n B')"), ctxOf([[k('A U B'), .8]]), null).numeric, .2);
  near(solveQuery(q('P(A n B)'), ctxOf([[k('A'), .3], [k('B'), .2]], { mutexPairs: new Set(['A ~ B']) }), null).numeric, 0);
  // conditional given as a fact, joint wanted
  near(solveQuery(q('P(A n B)'), ctxOf([[k('B'), .5], ['A|B', .8]]), null).numeric, .4);
  // conditional query answered from joint facts the rules cannot chain
  near(solveQuery(q('P(A|B)'), ctxOf([[k('A U B'), .7], [k('A'), .4], [k('B'), .5]]), null).numeric, .2 / .5);
});

test('linear: independence declared, marginals known, union wanted', () => {
  const ctx = ctxOf([[k('A'), .5], [k('B'), .4]], { independentGroups: [new Set([k('A'), k('B')])] });
  const model = buildLinearModel(ctx, ['A', 'B']);
  near(model.valueOf(q('A n B')).value, .2);
  near(model.valueOf(q('A U B')).value, .7);
});

test('linear: under-determined questions stay undetermined instead of guessing', () => {
  const out = solveQuery(q('P(A n B)'), ctxOf([[k('A'), .5], [k('B'), .6]]), null);
  assert.equal(out.numeric, null);
});

test('linear: contradictions are detected', () => {
  // P(A∩B) > P(A)
  let p = findContextProblem(ctxOf([[k('A'), .2], [k('A n B'), .4]]));
  assert.ok(p && /âm/.test(p), p);
  // P(A∪B) < P(A)
  p = findContextProblem(ctxOf([[k('A'), .5], [k('A U B'), .4]]));
  assert.ok(p && /âm/.test(p), p);
  // inconsistent inclusion-exclusion data
  p = findContextProblem(ctxOf([[k('A'), .5], [k('B'), .3], [k('A n B'), .1], [k('A U B'), .9]]));
  assert.ok(p && /mâu thuẫn/.test(p), p);
  // partition that does not sum to 1
  p = findContextProblem(ctxOf([[k('B1'), .6], [k('B2'), .7], [k('B3'), .1]], { partition: ['B1', 'B2', 'B3'] }));
  assert.ok(p, 'partition with sum 1.4 must be refused');
  // independent AND mutually exclusive with positive probabilities
  p = findContextProblem(ctxOf([[k('A'), .4], [k('B'), .3]], { independentGroups: [new Set([k('A'), k('B')])], mutexPairs: new Set(['A ~ B']) }));
  assert.ok(p, 'independent + exclusive with positive probabilities must be refused');
  // fine data stays fine
  assert.equal(findContextProblem(ctxOf([[k('A'), .5], [k('B'), .3], [k('A n B'), .1]])), null);
  assert.equal(findContextProblem(ctxOf([[k('B1'), .3], [k('B2'), .5], [k('B3'), .2]], { partition: ['B1', 'B2', 'B3'] })), null);
});

test('venn regions: inferred through the linear model; shared solver covers the rest', () => {
  // only unions given: the rule solver cannot fill any region, the linear model fills all
  const ctx = ctxOf([[k('A'), .5], [k('B'), .6], [k('A U B'), .8]]);
  const { names, regions } = computeMinterms(['A', 'B'], ctx);
  const by = {}; regions.forEach(r => { by[r.mask] = r.numeric; });
  near(by[3], .3); near(by[1], .2); near(by[2], .3); near(by[0], .2);
  assert.deepEqual(consistencyWarnings(names, regions, null), []);
});

test('venn regions with the user 4-set data sum to 1', () => {
  const ctx = ctxOf([
    [k('A'), .3], [k('B'), .3], [k('C'), .4], [k('D'), .4],
    [k('A n B'), .1], [k('A n C'), .1], [k('A n D'), .1], [k('B n C'), .1], [k('B n D'), .1], ['C|D', .375],
    [k('A n B n C'), .03], [k('A n B n D'), .03], ['(C∩D)|A', 2 / 15], ['D|(B∩C)', .4], [k('A n B n C n D'), .01],
  ]);
  const { regions } = computeMinterms(['A', 'B', 'C', 'D'], ctx);
  assert.ok(regions.every(r => r.numeric != null));
  near(regions.reduce((s, r) => s + r.numeric, 0), 1, 1e-6);
  assert.ok(regions.every(r => r.numeric > -1e-9));
});

test('the linear model also answers for an event over more sets than the Venn shows', () => {
  const ctx = ctxOf([[k('B1'), .3], [k('B2'), .5], [k('B3'), .2], ['A|B1', .1], ['A|B2', .2], ['A|B3', .05]], { partition: ['B1', 'B2', 'B3'] });
  near(solveQuery(q('P(A)'), ctx, null).numeric, .14);
  near(solveQuery(q('P(B1|A)'), ctx, null).numeric, .03 / .14);
});

test('large independent groups stay fast and correct (10 sets)', () => {
  const names = 'ABCDEFGHIJ'.split('');
  const ctx = ctxOf(names.map(n => [n, 0.5]), { independentGroups: [new Set(names)] });
  const t = Date.now();
  const out = solveQuery(q('P(' + names.join(' U ') + ')'), ctx, null);
  near(out.numeric, 1 - Math.pow(0.5, 10), 1e-12);
  const { regions } = computeMinterms(names, ctx, out.model);
  near(regions.reduce((s, r) => s + r.numeric, 0), 1, 1e-9);
  assert.ok(Date.now() - t < 4000, `took ${Date.now() - t} ms`);
});

test('independence among up to 8 sets is fully usable for reverse inference too', () => {
  const names = 'ABCDEF'.split('');
  const ctx = ctxOf(names.map(n => [n, 0.5]), { independentGroups: [new Set(names)] });
  const model = buildLinearModel(ctx, names);
  near(model.valueOf(q('A n B n C n D n E n F')).value, 1 / 64);
  near(model.valueOf(q("A n B' n C")).value, 1 / 8);
});
