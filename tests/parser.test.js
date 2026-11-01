const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('./helpers/load');
const M = loadModules();
const { parseQuery, parseExpression, flatten, canonicalKey, exprToText, bestFraction, tokenize, parseCanonicalKey } = M;

const key = s => canonicalKey(flatten(parseQuery(s).arg));

test('plain operators and precedence (n binds tighter than U)', () => {
  assert.equal(key('A U B'), '(A∪B)');
  assert.equal(key('A n B'), '(A∩B)');
  assert.equal(key('A U B n C'), key('A U (B n C)'));
  assert.notEqual(key('(A U B) n C'), key('A U B n C'));
});

test('implicit intersection: AB, ABC, and after a complement', () => {
  assert.equal(key('AB'), key('A n B'));
  assert.equal(key('P(ABC)'), key('A n B n C'));
  assert.equal(key("ABC'D"), key("A n B n C' n D"));
  assert.equal(key("A'BCD"), key("A' n B n C n D"));
  assert.equal(key('A(B U C)'), key('A n (B U C)'));
});

test('U and n are reserved operators even inside an unbroken run of letters (what OCR emits)', () => {
  assert.equal(key('AUB'), key('A U B'));
  assert.equal(key('AnB'), key('A n B'));
  assert.equal(key('ABUCD'), key('A n B U C n D'));
  assert.equal(key("ABC'DUA'BCD"), key("A n B n C' n D U A' n B n C n D"));
});

test('names with trailing digits stay one set', () => {
  assert.equal(key('B1'), 'B1');
  assert.equal(key('B1UB2'), '(B1∪B2)');
  assert.deepEqual(tokenize('B1').map(t => t.type + (t.name || '')), ['ATOMB1']);
});

test("complement spellings agree: A', A^c, A^{c}, \\overline{A}", () => {
  const k = key("A'");
  for (const s of ['A^c', 'A^{c}', '\\overline{A}', '\\bar{A}']) assert.equal(key(s), k, s);
  assert.equal(key("(A U B)'"), key('\\overline{A \\cup B}'));
});

test("difference A \\ B = A n B'", () => {
  assert.equal(key('A \\ B'), key("A n B'"));
  assert.equal(key('A \\setminus B'), key("A n B'"));
});

test('LaTeX input matches the plain notation', () => {
  assert.equal(key('P(A \\cup (B \\cap C))'), key('P(A U (B n C))'));
  assert.equal(key('P(A \\mid B)'), key('P(A|B)'));
});

test('conditional probability parses to COND with the right parts', () => {
  const node = flatten(parseQuery('P(C n D | A)').arg);
  assert.equal(node.type, 'COND');
  assert.equal(canonicalKey(node.arg), '(C∩D)');
  assert.equal(canonicalKey(node.given), 'A');
});

test('flatten removes double complements and absorbs Ω / ∅', () => {
  assert.equal(key("A''"), 'A');
  assert.equal(canonicalKey(flatten(parseExpression('A U \\Omega'))), 'Ω');
  assert.equal(canonicalKey(flatten(parseExpression('A n \\emptyset'))), '∅');
});

test('malformed input raises a readable error; trailing garbage after P(...) is not silently dropped', () => {
  assert.throws(() => parseQuery('P(A U '), /Lỗi cú pháp/);
  assert.throws(() => parseQuery('P(A))'), /Lỗi cú pháp/);
  assert.throws(() => parseQuery('P(A) U B'), /còn dư/);
  assert.throws(() => parseQuery('P(A)=0.6'), /còn dư/);
});

test('exprToText round-trips through the parser to the same canonical form', () => {
  const samples = ['A', "A'", 'A n B', 'A U B', 'A U (B n C)', "(A U B)'", 'A n (B U C)', "AB'CD",
    "ABC'D U A'BCD", 'B1 U B2', 'A|B', 'C n D | A', 'D | B n C', "(A n B)' U C"];
  for (const s of samples) {
    const node = flatten(parseQuery(s).arg);
    assert.equal(canonicalKey(flatten(parseQuery(exprToText(node)).arg)), canonicalKey(node), s);
  }
});

test('parseCanonicalKey inverts canonicalKey', () => {
  for (const s of ['A', "A'", 'A n B', 'A U (B n C)', "(A U B)'", 'C n D | A', 'D | B n C', "A n B' n C", 'B1 U B2']) {
    const node = flatten(parseQuery(s).arg);
    assert.equal(canonicalKey(flatten(parseCanonicalKey(canonicalKey(node)))), canonicalKey(node), s);
  }
});

test('bestFraction recovers small fractions and refuses to guess otherwise', () => {
  const f = x => { const r = bestFraction(x); return r && `${r.p}/${r.q}${r.exact ? '' : '~'}`; };
  assert.equal(f(0.875), '7/8');
  assert.equal(f(1 / 3), '1/3');
  assert.equal(f(0.88), '22/25');
  assert.equal(f(0.8799998999999998), '22/25~');
  assert.equal(f(0), '0/1');
  assert.equal(f(1), '1/1');
  assert.equal(f(0.3333), null);
  assert.equal(f(1.2), null);
});

test('parseValueInput: decimals (point or Vietnamese comma), fractions, and rejects', () => {
  const { parseValueInput, tryLineAsHypothesis } = M;
  assert.equal(parseValueInput('0.375'), 0.375);
  assert.equal(parseValueInput('0,375'), 0.375);
  assert.equal(parseValueInput(' 3/8 '), 0.375);
  assert.equal(parseValueInput('3 / 8'), 0.375);
  assert.equal(parseValueInput('1,5/3'), 0.5);
  assert.equal(parseValueInput('.5'), 0.5);
  assert.ok(isNaN(parseValueInput('1/0')));
  assert.ok(isNaN(parseValueInput('abc')));
  assert.ok(isNaN(parseValueInput('0.3x')));
  assert.ok(isNaN(parseValueInput('')));
  assert.deepEqual(tryLineAsHypothesis('P(A)=0,6'), { exprPart: 'P(A)', value: 0.6 });
  assert.deepEqual(tryLineAsHypothesis('P(A U B) = 3/8'), { exprPart: 'P(A U B)', value: 0.375 });
  assert.equal(tryLineAsHypothesis('P(A)=0.D'), null);
  assert.equal(tryLineAsHypothesis('P(A'), null);
});
