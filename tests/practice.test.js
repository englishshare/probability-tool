const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('./helpers/load');
const M = loadModules();
const { makeExercise, exerciseContext, answerMatches, EXERCISE_KINDS, solveQuery, parseQuery, flatten, findContextProblem } = M;

test('generator is deterministic per seed and varies across seeds', () => {
  const a = makeExercise(42, 'pie3'), b = makeExercise(42, 'pie3'), c = makeExercise(43, 'pie3');
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.facts, c.facts);
});

test('every exercise kind, over many seeds: facts are consistent AND the solver reproduces the generator\'s answer from the facts alone', () => {
  let n = 0;
  for (const kind of EXERCISE_KINDS) {
    for (let seed = 1; seed <= 120; seed++) {
      const ex = makeExercise(seed, kind);
      const ctx = exerciseContext(ex);
      assert.equal(findContextProblem(ctx), null, `${kind} #${seed}: ${JSON.stringify(ex.facts)}`);
      const out = solveQuery(flatten(parseQuery(ex.question).arg), ctx, null);
      assert.ok(out.numeric != null, `${kind} #${seed}: unresolved ${ex.question} from ${JSON.stringify(ex.facts)}`);
      assert.ok(Math.abs(out.numeric - ex.answer) < 1e-5, `${kind} #${seed}: ${ex.question} solver ${out.numeric} vs answer ${ex.answer}`);
      n++;
    }
  }
  assert.equal(n, EXERCISE_KINDS.length * 120);
});

test('answers are accepted as decimal, comma decimal or fraction, within rounding', () => {
  const ex = { answer: 2 / 3 };
  for (const t of ['0.667', '0,667', '2/3', ' 0.6667 ']) assert.ok(answerMatches(ex, t), t);
  for (const t of ['0.66', '0.7', 'abc', '']) assert.ok(!answerMatches(ex, t), t);
});

test('the rule-based solver (not just the linear fallback) writes a worked solution for the textbook kinds', () => {
  const rules = {};
  for (const kind of ['pie2', 'pie3', 'conditional', 'totalPair', 'bayesPair', 'totalPartition', 'bayesPartition', 'independent', 'independentInverse', 'exclusive']) {
    let viaRule = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const ex = makeExercise(seed, kind);
      const out = solveQuery(flatten(parseQuery(ex.question).arg), exerciseContext(ex), null);
      if (out.via === 'rule' && out.steps.length) viaRule++;
    }
    rules[kind] = viaRule;
  }
  for (const [kind, count] of Object.entries(rules)) assert.ok(count >= 36, `${kind}: only ${count}/40 solved with a rule-based derivation`);
});
