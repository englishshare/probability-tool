/* ============================================================
   LINEAR: inference over the 2^n elementary regions (minterms)

   The rule-based solver reasons top-down: to find P(A∪B) it asks for
   P(A), P(B), P(A∩B). It cannot run a rule backwards, so given P(A), P(B)
   and P(A∪B) it has no way to get P(A∩B). The fix is to stop treating the
   facts as rules and treat them as what they are: linear equations over
   the probabilities x_m of the elementary regions m (which of A, B, C...
   an outcome belongs to):

       P(E)      = sum of x_m over regions m inside E
       P(E|F)=c  =>  P(E∩F) - c*P(F) = 0
       mutually exclusive A, B  =>  P(A∩B) = 0
       partition B1..Bk         =>  P(Bi∩Bj) = 0 and P(B1∪..∪Bk) = 1
       independent A, B, ...    =>  P(∩S) = prod P(.)  (once those are known)

   Row-reducing that system (Gaussian elimination) answers, exactly, every
   question the facts determine -- in any direction -- and exposes
   contradictions: an equation 0 = 1, or a region forced to a negative
   probability. A query is determined iff its indicator vector lies in the
   row space; the coefficients of that combination are also what makes an
   explanation possible ("P(A∩B) = P(A) + P(B) - P(A∪B)").
   ============================================================ */

const MAX_LINEAR_ATOMS = 12;
const LIN_TOL = 1e-9;

function evalAtMask(node, idx, mask) {
  switch (node.type) {
    case 'ATOM': return ((mask >> idx[node.name]) & 1) === 1;
    case 'EMPTY': return false;
    case 'UNIVERSE': return true;
    case 'COMPLEMENT': return !evalAtMask(node.arg, idx, mask);
    case 'UNION': return node.args.some(a => evalAtMask(a, idx, mask));
    case 'INTERSECT': return node.args.every(a => evalAtMask(a, idx, mask));
    default: return false;
  }
}

function indicatorVector(node, idx, N) {
  const v = new Float64Array(N);
  for (let m = 0; m < N; m++) v[m] = evalAtMask(node, idx, m) ? 1 : 0;
  return v;
}

// Incrementally maintained reduced row-echelon form. Each stored row also
// carries `comb`: how it was built from the ORIGINAL equations, which is
// what turns "this query is determined" into "...because of these facts".
class LinearSystem {
  constructor(N) { this.N = N; this.rows = []; this.origin = []; this.conflict = null; }

  add(vec, rhs, meta) {
    const k = this.origin.length;
    this.origin.push(meta);
    const v = Float64Array.from(vec);
    let b = rhs;
    const comb = new Array(k + 1).fill(0); comb[k] = 1;
    for (const r of this.rows) {
      const c = v[r.pivot];
      if (Math.abs(c) > LIN_TOL) {
        for (let j = 0; j < this.N; j++) v[j] -= c * r.vec[j];
        b -= c * r.rhs;
        for (let t = 0; t < r.comb.length; t++) comb[t] -= c * r.comb[t];
      }
    }
    let pivot = -1, best = LIN_TOL;
    for (let j = 0; j < this.N; j++) if (Math.abs(v[j]) > best) { best = Math.abs(v[j]); pivot = j; }
    if (pivot === -1) {
      if (Math.abs(b) > 1e-7 && !this.conflict) {
        this.conflict = { meta, involved: comb.map((c, t) => ({ c, t })).filter(x => Math.abs(x.c) > LIN_TOL && x.t !== k).map(x => this.origin[x.t]) };
      }
      return false;
    }
    const p = v[pivot];
    for (let j = 0; j < this.N; j++) v[j] /= p;
    b /= p;
    for (let t = 0; t < comb.length; t++) comb[t] /= p;
    for (const r of this.rows) {
      const c = r.vec[pivot];
      if (Math.abs(c) > LIN_TOL) {
        for (let j = 0; j < this.N; j++) r.vec[j] -= c * v[j];
        r.rhs -= c * b;
        while (r.comb.length < comb.length) r.comb.push(0);
        for (let t = 0; t < comb.length; t++) r.comb[t] -= c * comb[t];
      }
    }
    this.rows.push({ vec: v, rhs: b, comb, pivot });
    return true;
  }

  // P(Q) for an event with indicator q, if the facts determine it
  determine(q) {
    const v = Float64Array.from(q);
    let value = 0;
    const comb = new Array(this.origin.length).fill(0);
    for (const r of this.rows) {
      const c = v[r.pivot];
      if (Math.abs(c) > LIN_TOL) {
        for (let j = 0; j < this.N; j++) v[j] -= c * r.vec[j];
        value += c * r.rhs;
        for (let t = 0; t < r.comb.length; t++) comb[t] += c * r.comb[t];
      }
    }
    for (let j = 0; j < this.N; j++) if (Math.abs(v[j]) > 1e-7) return null;
    return { value, comb };
  }

  // regions whose own probability is pinned down by the equations alone
  determinedRegions() {
    const out = [];
    for (const r of this.rows) {
      let alone = true;
      for (let j = 0; j < this.N; j++) if (j !== r.pivot && Math.abs(r.vec[j]) > 1e-7) { alone = false; break; }
      if (alone) out.push({ mask: r.pivot, value: r.rhs, comb: r.comb });
    }
    return out;
  }
}

function regionLabel(names, mask) {
  return names.map((nm, i) => (((mask >> i) & 1) ? nm : nm + "'")).join(' ∩ ');
}

function factLabel(node, value) {
  if (node.type === 'COND') {
    const e = exprToText(node.arg), f = exprToText(node.given);
    return 'P(' + e + ' | ' + f + ') = ' + fmtNum(value) + ', tức P(' + e + ' ∩ ' + f + ') = ' + fmtNum(value) + ' · P(' + f + ')';
  }
  return 'P(' + exprToText(node) + ') = ' + fmtNum(value);
}

// Builds the system for a context (the same {knownProb, independentGroups,
// mutexPairs, partition(s)} the rule-based solver reads). Returns null when
// there are too many sets for a 2^n table, otherwise a model that answers
// valueOf(event) and reports `problem` if the facts cannot all hold.
function buildLinearModel(ctx, extraAtoms) {
  const atoms = new Set(extraAtoms || []);
  const facts = [];
  for (const [key, value] of ctx.knownProb) {
    try { const node = parseCanonicalKey(key); facts.push({ node, value }); collectAtoms(node, atoms); } catch (e) { /* skip unreadable key */ }
  }
  const mutex = [];
  for (const pk of ctx.mutexPairs || []) {
    try { const [k1, k2] = pk.split(' ~ '); const a = parseCanonicalKey(k1), b = parseCanonicalKey(k2); mutex.push([a, b]); collectAtoms(a, atoms); collectAtoms(b, atoms); } catch (e) { /* skip */ }
  }
  const groups = [];
  for (const g of ctx.independentGroups || []) {
    try { const nodes = [...g].map(parseCanonicalKey); nodes.forEach(n => collectAtoms(n, atoms)); groups.push(nodes); } catch (e) { /* skip */ }
  }
  const partitions = partitionsOf(ctx).map(p => p.map(nm => ({ type: 'ATOM', name: nm })));
  partitions.forEach(part => part.forEach(p => atoms.add(p.name)));

  const names = [...atoms].sort();
  const n = names.length;
  if (n === 0 || n > MAX_LINEAR_ATOMS) return null;
  const N = 1 << n;
  const idx = {}; names.forEach((nm, i) => { idx[nm] = i; });
  const ind = node => indicatorVector(flatten(node), idx, N);
  const and = (a, b) => ({ type: 'INTERSECT', args: [a, b] });
  const sys = new LinearSystem(N);

  sys.add(new Float64Array(N).fill(1), 1, { kind: 'norm', label: 'tổng xác suất của mọi vùng bằng 1' });
  for (const f of facts) {
    if (f.node.type === 'COND') {
      const num = ind(and(f.node.arg, f.node.given)), den = ind(f.node.given);
      const row = new Float64Array(N);
      for (let m = 0; m < N; m++) row[m] = num[m] - f.value * den[m];
      sys.add(row, 0, { kind: 'cond', label: factLabel(f.node, f.value) });
    } else {
      sys.add(ind(f.node), f.value, { kind: 'fact', node: f.node, value: f.value, label: factLabel(f.node, f.value) });
    }
  }
  for (const [a, b] of mutex) {
    sys.add(ind(and(a, b)), 0, { kind: 'mutex', label: exprToText(a) + ' và ' + exprToText(b) + ' xung khắc' });
  }
  for (const partition of partitions) {
    const plabel = '{' + partition.map(p => p.name).join(', ') + '}';
    for (let i = 0; i < partition.length; i++) {
      for (let j = i + 1; j < partition.length; j++) {
        sys.add(ind(and(partition[i], partition[j])), 0, { kind: 'partition', label: partition[i].name + ' và ' + partition[j].name + ' không giao nhau (phân hoạch ' + plabel + ')' });
      }
    }
    sys.add(ind({ type: 'UNION', args: partition }), 1, { kind: 'partition', label: 'phân hoạch ' + plabel + ' phủ kín không gian mẫu' });
  }

  // Independence is a product of probabilities, so it only becomes a linear
  // equation once the factors are known; keep adding equations as more of
  // them become determined, until nothing new appears. Mutual independence of
  // g sets means 2^g - g - 1 product equations, and dense elimination over
  // that many rows is quadratic in 2^g -- seconds at g = 10. Past
  // FULL_INDEP_MAX sets only the small subsets (pairs and triples) are
  // expanded; the rule-based solver, which handles independence by formula,
  // still covers the big groups, so only the *reverse* inference from such a
  // group gets weaker, not the answers.
  const FULL_INDEP_MAX = 8, BIG_GROUP_SUBSET = 3;
  const pending = [];
  for (const nodes of groups) {
    const g = Math.min(nodes.length, 12);
    const maxSize = g <= FULL_INDEP_MAX ? g : BIG_GROUP_SUBSET;
    for (let mask = 3; mask < (1 << g); mask++) {
      if ((mask & (mask - 1)) === 0) continue;
      let size = 0; for (let t = mask; t; t &= t - 1) size++;
      if (size > maxSize) continue;
      pending.push({ nodes: nodes.filter((_, i) => (mask >> i) & 1), done: false });
    }
  }
  const memberValue = new Map();
  const valueOfMember = nd => {
    const key = canonicalKey(flatten(nd));
    if (memberValue.has(key)) return memberValue.get(key);
    const det = sys.determine(ind(nd));
    if (det) memberValue.set(key, det.value);
    return det ? det.value : null;
  };
  for (let progress = true; progress;) {
    progress = false;
    for (const item of pending) {
      if (item.done) continue;
      const vals = item.nodes.map(valueOfMember);
      const unknown = vals.map((v, i) => (v == null ? i : -1)).filter(i => i >= 0);
      if (unknown.length === vals.length) continue;           // nothing known to multiply yet
      const inter = item.nodes.length === 1 ? item.nodes[0] : { type: 'INTERSECT', args: item.nodes };
      const label = item.nodes.map(exprToText).join(', ') + ' độc lập: P(giao) = tích các xác suất';
      if (unknown.length === 0) {
        sys.add(ind(inter), vals.reduce((p, v) => p * v, 1), { kind: 'indep', label });
      } else {
        // Mutually independent sets stay independent of any event built from
        // the others, so P(K ∩ U) = P(K)·P(U), where K is the known members
        // (their product c is a number) and U the intersection of those still
        // unknown. That is a plain linear equation in the region
        // probabilities -- P(K∩U) - c·P(U) = 0 -- so the rest of the system
        // can pin the unknowns down (for instance from P(A∪B)).
        const unknownNodes = unknown.map(i => item.nodes[i]);
        const u = unknownNodes.length === 1 ? unknownNodes[0] : { type: 'INTERSECT', args: unknownNodes };
        const c = vals.reduce((p, v, i) => (v == null ? p : p * v), 1);
        const num = ind(inter), den = ind(u), row = new Float64Array(N);
        for (let m = 0; m < N; m++) row[m] = num[m] - c * den[m];
        sys.add(row, 0, { kind: 'indep', label });
      }
      item.done = true; progress = true;
    }
  }

  const model = { names, idx, N, sys, problem: null, origin: sys.origin };
  model.valueOf = node => {
    // an event mentioning a set no fact ever touched cannot be determined
    for (const a of collectAtoms(flatten(node))) if (!(a in idx)) return null;
    return sys.determine(ind(node));
  };

  if (sys.conflict) {
    const others = sys.conflict.involved.filter(m => m.kind !== 'norm').map(m => m.label);
    model.problem = {
      kind: 'inconsistent',
      text: 'Giả thiết "' + sys.conflict.meta.label + '" mâu thuẫn với ' + (others.length ? others.join('; ') : 'điều kiện tổng xác suất bằng 1') + '.',
    };
  } else {
    for (const r of sys.determinedRegions()) {
      if (r.value < -1e-7 || r.value > 1 + 1e-7) {
        const used = r.comb.map((c, t) => ({ c, t })).filter(x => Math.abs(x.c) > LIN_TOL).map(x => sys.origin[x.t]).filter(m => m.kind !== 'norm').map(m => m.label);
        model.problem = {
          kind: r.value < 0 ? 'negative' : 'over',
          text: 'Với các giả thiết này, vùng ' + regionLabel(names, r.mask) + ' có xác suất ' + (r.value < 0 ? 'âm' : 'lớn hơn 1') + ' (' + fmtNum(r.value) + ')' + (used.length ? ' — từ: ' + used.join('; ') : '') + '.',
        };
        break;
      }
    }
  }
  if (!model.problem && N <= 256 && sys.rows.length <= 256 && lpFeasible(sys.rows, N) === false) {
    model.problem = {
      kind: 'infeasible',
      text: 'Các giả thiết không thể cùng đúng: không có cách gán xác suất không âm cho các vùng sao cho thỏa mãn đồng thời tất cả (kiểm tra bằng quy hoạch tuyến tính). Hãy kiểm tra lại các giá trị đã nhập.',
    };
  }
  return model;
}

// ---- feasibility (simplex, phase I) ---------------------------------------
// Row reduction can only notice a contradiction that pins a region to a
// negative value, or yields 0 = c. Facts can also be impossible together
// while leaving every individual region free -- "x1 + x2 = -0.1" with both
// regions unknown. The honest test is whether ANY non-negative assignment of
// the 2^n region probabilities satisfies every equation: a linear-programming
// feasibility problem. Phase I of the simplex method answers it by trying to
// drive a set of artificial slack variables to zero (Bland's rule guards
// against cycling).
function lpFeasible(rows, N) {
  const m = rows.length;
  if (!m) return true;
  const W = N + m + 1;
  const T = rows.map((r, i) => {
    const t = new Float64Array(W);
    const sign = r.rhs < 0 ? -1 : 1;
    for (let j = 0; j < N; j++) t[j] = sign * r.vec[j];
    t[N + i] = 1;
    t[W - 1] = sign * r.rhs;
    return t;
  });
  const basis = rows.map((_, i) => N + i);
  const z = new Float64Array(W);
  for (let j = 0; j < N; j++) { let c = 0; for (let i = 0; i < m; i++) c -= T[i][j]; z[j] = c; }
  for (let i = 0; i < m; i++) z[W - 1] -= T[i][W - 1];
  const EPS = 1e-9, DANTZIG_ITERS = 400, MAX_ITERS = 6000;
  let optimal = false;
  for (let iter = 0; iter < MAX_ITERS; iter++) {
    // Most-negative reduced cost is fast; once it has run a while, switch to
    // the smallest index (Bland's rule), which cannot cycle.
    let e = -1;
    if (iter < DANTZIG_ITERS) {
      let low = -EPS;
      for (let j = 0; j < N + m; j++) if (z[j] < low) { low = z[j]; e = j; }
    } else {
      for (let j = 0; j < N + m; j++) if (z[j] < -EPS) { e = j; break; }
    }
    if (e < 0) { optimal = true; break; }
    let r = -1, best = Infinity;
    for (let i = 0; i < m; i++) {
      if (T[i][e] > EPS) {
        const ratio = T[i][W - 1] / T[i][e];
        if (ratio < best - 1e-12 || (Math.abs(ratio - best) <= 1e-12 && basis[i] < basis[r])) { best = ratio; r = i; }
      }
    }
    if (r < 0) break;
    const piv = T[r][e];
    for (let j = 0; j < W; j++) T[r][j] /= piv;
    for (let i = 0; i < m; i++) {
      if (i === r) continue;
      const f = T[i][e];
      if (Math.abs(f) > 0) for (let j = 0; j < W; j++) T[i][j] -= f * T[r][j];
    }
    const fz = z[e];
    for (let j = 0; j < W; j++) z[j] -= fz * T[r][j];
    basis[r] = e;
  }
  // Only a finished run proves anything. Running out of iterations says
  // nothing about feasibility, so it must never be reported as a conflict.
  if (!optimal) return null;
  return -z[W - 1] < 1e-7;     // total artificial slack left
}

// ---- explanations -------------------------------------------------------
function termsOf(model, det) {
  return det.comb.map((c, k) => ({ coef: c, meta: model.origin[k] })).filter(x => Math.abs(x.coef) > LIN_TOL);
}

// "P(A∩B) = P(A) + P(B) - P(A∪B) = 0.5 + 0.6 - 0.8 = 0.3" when only plain
// facts are involved; otherwise just the value plus the list of equations used.
function describeDetermination(model, node, det, colorOf) {
  const rows = termsOf(model, det);
  const lhs = toProbLatex(node, colorOf);
  const plain = rows.length > 0 && rows.every(r => r.meta.kind === 'fact' || r.meta.kind === 'norm');
  if (!plain) {
    return {
      eq: lhs + ' = ' + fmtNum(det.value),
      note: rows.length ? 'Các ràng buộc đã dùng: ' + rows.filter(r => r.meta.kind !== 'norm').map(r => r.meta.label).join('; ') + '.' : '',
    };
  }
  let sym = '', num = '';
  rows.forEach((r, i) => {
    const a = Math.abs(r.coef), neg = r.coef < 0, unit = Math.abs(a - 1) < 1e-9;
    const isNorm = r.meta.kind === 'norm';
    const symTerm = isNorm ? (unit ? '1' : fmtNum(a)) : (unit ? '' : fmtNum(a) + ' \\cdot ') + toProbLatex(r.meta.node, colorOf);
    const val = isNorm ? 1 : r.meta.value;
    const numTerm = unit ? fmtNum(val) : fmtNum(a) + ' \\cdot ' + fmtNum(val);
    const sign = i === 0 ? (neg ? '-' : '') : (neg ? ' - ' : ' + ');
    sym += sign + symTerm;
    num += sign + numTerm;
  });
  return { eq: lhs + ' = ' + sym + ' = ' + num + ' = ' + fmtNum(det.value), note: '' };
}

// Steps for a query the rule-based solver could not close, derived from the
// linear model. Returns null when the facts do not determine it.
function explainViaLinear(node, model, colorOf) {
  const rule = 'Suy ra từ hệ phương trình tuyến tính trên các vùng cơ bản';
  if (node.type === 'COND') {
    const inter = flatten({ type: 'INTERSECT', args: [node.arg, node.given] });
    const dn = model.valueOf(inter), dd = model.valueOf(node.given);
    if (!dn || !dd || dd.value <= 1e-12) return null;
    const value = dn.value / dd.value;
    const s1 = describeDetermination(model, inter, dn, colorOf);
    const s2 = describeDetermination(model, node.given, dd, colorOf);
    return {
      numeric: value,
      steps: [
        { rule, eq: s1.eq, note: s1.note },
        { rule, eq: s2.eq, note: s2.note },
        {
          rule: 'Định nghĩa xác suất có điều kiện',
          eq: 'P\\left(' + toLatex(node.arg, colorOf) + ' \\mid ' + toLatex(node.given, colorOf) + '\\right) = \\dfrac{' + toProbLatex(inter, colorOf) + '}{' + toProbLatex(node.given, colorOf) + '} = \\dfrac{' + fmtNum(dn.value) + '}{' + fmtNum(dd.value) + '} = ' + fmtNum(value),
        },
      ],
    };
  }
  const det = model.valueOf(node);
  if (!det) return null;
  const d = describeDetermination(model, node, det, colorOf);
  return { numeric: det.value, steps: [{ rule, eq: d.eq, note: d.note }] };
}
