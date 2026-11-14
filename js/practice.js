/* ============================================================
   PRACTICE: random exercises with a known answer

   Every exercise starts from a joint distribution made of whole counts
   (so the hypotheses can never contradict each other), then reveals a few
   facts about it and asks for something else. The answer comes from the
   counts, independently of the solver -- which makes the generator double as
   a test: the solver must reproduce each answer from the revealed facts alone.
   ============================================================ */

function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
const rint = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const pickOne = (rng, list) => list[Math.floor(rng() * list.length)];

// k positive integers summing to total
function composition(rng, k, total) {
  const cuts = new Set();
  while (cuts.size < k - 1) cuts.add(rint(rng, 1, total - 1));
  const sorted = [0, ...[...cuts].sort((a, b) => a - b), total];
  return sorted.slice(1).map((c, i) => c - sorted[i]);
}

const dec = x => String(Math.round(x * 1e6) / 1e6);

// masks: bit 0 = in A, bit 1 = in B, bit 2 = in C
function probOf(counts, total, pred) { let s = 0; counts.forEach((c, m) => { if (pred(m)) s += c; }); return s / total; }
const inA = m => (m & 1) === 1, inB = m => (m & 2) === 2, inC = m => (m & 4) === 4;

const EXERCISE_KINDS = ['pie2', 'pie3', 'conditional', 'inverse', 'independent', 'independentInverse', 'exclusive', 'totalPair', 'bayesPair', 'totalPartition', 'bayesPartition'];

function makeExercise(seed, kind) {
  const rng = makeRng(seed);
  kind = kind || EXERCISE_KINDS[Math.floor(rng() * EXERCISE_KINDS.length)];
  const ex = { kind, seed, facts: [], partitions: [], indep: [], mutex: [], question: '', answer: 0, hint: '' };
  const fact = (expr, v) => ex.facts.push([expr, dec(v)]);

  if (kind === 'pie2' || kind === 'conditional' || kind === 'inverse') {
    const c = composition(rng, 4, 20);                     // regions 0..3 over {A, B}
    const pA = probOf(c, 20, inA), pB = probOf(c, 20, inB), pAB = probOf(c, 20, m => inA(m) && inB(m));
    if (kind === 'pie2') {
      fact('A', pA); fact('B', pB); fact('A n B', pAB);
      ex.question = rng() < 0.5 ? 'P(A U B)' : "P(A' n B')";
      ex.answer = ex.question === 'P(A U B)' ? probOf(c, 20, m => inA(m) || inB(m)) : probOf(c, 20, m => !inA(m) && !inB(m));
      ex.hint = 'Nguyên lý bù trừ và phần bù.';
    } else if (kind === 'conditional') {
      fact('A', pA); fact('A n B', pAB);
      ex.question = 'P(B|A)'; ex.answer = pAB / pA;
      ex.hint = 'Định nghĩa xác suất có điều kiện.';
    } else {
      fact('A', pA); fact('B', pB); fact('A U B', probOf(c, 20, m => inA(m) || inB(m)));
      ex.question = 'P(A n B)'; ex.answer = pAB;
      ex.hint = 'Dùng công thức bù trừ theo chiều ngược lại.';
    }
  } else if (kind === 'pie3') {
    const c = composition(rng, 8, 40);
    fact('A', probOf(c, 40, inA)); fact('B', probOf(c, 40, inB)); fact('C', probOf(c, 40, inC));
    fact('A n B', probOf(c, 40, m => inA(m) && inB(m))); fact('A n C', probOf(c, 40, m => inA(m) && inC(m)));
    fact('B n C', probOf(c, 40, m => inB(m) && inC(m))); fact('A n B n C', probOf(c, 40, m => inA(m) && inB(m) && inC(m)));
    ex.question = 'P(A U B U C)'; ex.answer = probOf(c, 40, m => m !== 0);
    ex.hint = 'Nguyên lý bù trừ cho 3 biến cố.';
  } else if (kind === 'independent' || kind === 'independentInverse') {
    const pA = rint(rng, 1, 9) / 10, pB = rint(rng, 1, 9) / 10;
    ex.indep.push(['A', 'B']);
    if (kind === 'independent') {
      fact('A', pA); fact('B', pB);
      ex.question = pickOne(rng, ['P(A U B)', "P(A n B')", "P(A' n B')"]);
      ex.answer = { 'P(A U B)': pA + pB - pA * pB, "P(A n B')": pA * (1 - pB), "P(A' n B')": (1 - pA) * (1 - pB) }[ex.question];
      ex.hint = 'A và B độc lập nên P(A ∩ B) = P(A)·P(B).';
    } else {
      fact('A', pA); fact('A U B', pA + pB - pA * pB);
      ex.question = 'P(B)'; ex.answer = pB;
      ex.hint = 'A, B độc lập: P(A ∪ B) = P(A) + P(B) − P(A)·P(B), rồi giải ra P(B).';
    }
  } else if (kind === 'exclusive') {
    const p = composition(rng, 4, 20).map(x => x / 20);    // A, B, C and the rest
    fact('A', p[0]); fact('B', p[1]); fact('C', p[2]);
    ex.mutex.push(['A', 'B', 'C']);
    ex.question = 'P(A U B U C)'; ex.answer = p[0] + p[1] + p[2];
    ex.hint = 'Ba biến cố đôi một xung khắc: xác suất của hợp bằng tổng xác suất.';
  } else if (kind === 'totalPair' || kind === 'bayesPair') {
    const pB = rint(rng, 2, 8) / 10, a1 = rint(rng, 1, 9) / 10, a2 = rint(rng, 1, 9) / 10;
    fact('B', pB); fact('A|B', a1);
    if (rng() < 0.5) fact("A|B'", a2); else fact("A'|B'", 1 - a2);
    const pA = a1 * pB + a2 * (1 - pB);
    if (kind === 'totalPair') { ex.question = 'P(A)'; ex.answer = pA; ex.hint = 'Công thức xác suất toàn phần với hệ {B, B̄}.'; }
    else { ex.question = 'P(B|A)'; ex.answer = a1 * pB / pA; ex.hint = 'Công thức Bayes với hệ {B, B̄}.'; }
  } else {                                                  // totalPartition / bayesPartition
    const pb = composition(rng, 3, 10).map(x => x / 10);
    const a = [0, 0, 0].map(() => rint(rng, 1, 9) / 10);
    ex.partitions.push(['B1', 'B2', 'B3']);
    fact('B1', pb[0]); fact('B2', pb[1]);                 // B3 is left to the partition
    fact('A|B1', a[0]); fact('A|B2', a[1]);
    if (rng() < 0.5) fact('A|B3', a[2]); else fact("A'|B3", 1 - a[2]);
    const pA = a[0] * pb[0] + a[1] * pb[1] + a[2] * pb[2];
    if (kind === 'totalPartition') { ex.question = 'P(A)'; ex.answer = pA; ex.hint = 'Xác suất toàn phần; P(B3) = 1 − P(B1) − P(B2).'; }
    else { const i = rint(rng, 0, 2); ex.question = `P(B${i + 1}|A)`; ex.answer = a[i] * pb[i] / pA; ex.hint = 'Công thức Bayes; cần cả P(A) từ xác suất toàn phần.'; }
  }
  return ex;
}

// The context the solver reads, built from an exercise's facts and declarations
function exerciseContext(ex) {
  const knownProb = new Map();
  for (const [expr, v] of ex.facts) knownProb.set(canonicalKey(flatten(parseQuery(expr).arg)), parseValueInput(v));
  const mutexPairs = new Set();
  for (const group of ex.mutex) for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) mutexPairs.add(pairKey(group[i], group[j]));
  return {
    knownProb,
    independentGroups: ex.indep.map(g => new Set(g)),
    mutexPairs,
    partitions: ex.partitions.map(p => p.slice()),
    partition: ex.partitions[0] || null,
  };
}

// Same number, however the person writes it: "0.667", "2/3", "0,667"
function answerMatches(ex, text) {
  const v = parseValueInput(text);
  return !isNaN(v) && Math.abs(v - ex.answer) <= 0.0015;
}
