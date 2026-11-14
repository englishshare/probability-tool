/* ============================================================
   SOLVER: memoized rule-based recursive solver (step-by-step derivations)
   ============================================================ */

function distributeIntersect(x, unionNode) {
  if (unionNode.type === 'UNION') {
    return { type: 'UNION', args: unionNode.args.map(u => flatten({ type: 'INTERSECT', args: [x, u] })) };
  }
  return flatten({ type: 'INTERSECT', args: [x, unionNode] });
}

function inSameIndependentGroup(keys, ctx) {
  for (const grp of ctx.independentGroups) {
    if (keys.every(k => grp.has(k))) return true;
  }
  return false;
}

// A context may declare one partition (ctx.partition) or several
// (ctx.partitions); both spellings are read the same way.
function partitionsOf(ctx) {
  if (ctx.partitions) return ctx.partitions.filter(p => p && p.length);
  return ctx.partition && ctx.partition.length ? [ctx.partition] : [];
}

function complementOf(node) { return flatten({ type: 'COMPLEMENT', arg: node }); }

function makeSolver() {
  const cache = new Map();
  const cacheOrder = [];          // insertion order, so a failed attempt can be undone
  const steps = [];
  const missing = new Set();
  const inProgress = new Set();   // keys being solved right now (cycle guard)
  const explained = new Set();    // conditional facts already derived by complement
  let cuts = 0;                   // how many times the cycle guard has fired

  // A rule that may fail halfway (it solved some sub-problems, then found
  // one it cannot) must not leave its half-finished steps or sub-results
  // behind: the steps would read as dead ends, and a cached sub-result would
  // stop the *next* attempt from showing the step that derives it.
  const snapshot = () => ({ steps: steps.length, cache: cacheOrder.length });
  function rollback(s) {
    steps.length = s.steps;
    while (cacheOrder.length > s.cache) cache.delete(cacheOrder.pop());
  }
  const remember = (key, result) => {
     cache.set(key, result);
     cacheOrder.push(key);
  };

  // Wrap a sub-result's latex in parens when it's being subtracted or
  // multiplied and its own display isn't already self-delimiting (a bare
  // number, a single P(...) term, a product, or a \dfrac{}{}). Concatenating
  // a leading "-" or "\cdot" in front of an unparenthesized "X + Y - Z"
  // otherwise silently negates only the first term instead of the whole
  // group -- e.g. turning "- (X - Y)" into the wrong "- X - Y" instead of
  // "- X + Y".
  function wrapIfCompound(sub) {
    return sub.compound ? `\\left(${sub.latex}\\right)` : sub.latex;
  }

  // Whether any conditional fact was given at all: when none was, searching
  // every two-way split of a big intersection for one is pure wasted work.
  let condSeen = null;
  const hasCondFacts = ctx => {
    if (!condSeen || condSeen.ctx !== ctx) condSeen = { ctx, any: [...ctx.knownProb.keys()].some(k => k.includes('|')) };
    return condSeen.any;
  };

  const condLatex = (x, g, colorOf) => `P\\left(${toLatex(x, colorOf)} \\mid ${toLatex(g, colorOf)}\\right)`;

  // P(x | g) when it is a given fact, or follows from a given P(x' | g).
  // Never recurses: it only reads what was stated.
  function condValue(xNode, gNode, ctx) {
    const x = flatten(xNode), g = flatten(gNode);
    const kg = canonicalKey(g);
    const direct = canonicalKey(x) + '|' + kg;
    if (ctx.knownProb.has(direct)) return { numeric: ctx.knownProb.get(direct), via: 'direct' };
    const xc = complementOf(x);
    const viaKey = canonicalKey(xc) + '|' + kg;
    if (ctx.knownProb.has(viaKey)) {
      const from = ctx.knownProb.get(viaKey);
      return { numeric: 1 - from, via: 'complement', from, complementNode: xc };
    }
    return null;
  }

  function explainCond(cv, xNode, gNode, colorOf) {
    if (!cv || cv.via !== 'complement') return;
    const id = canonicalKey(flatten(xNode)) + '|' + canonicalKey(flatten(gNode));
    if (explained.has(id)) return;
    explained.add(id);
    steps.push({
      rule: 'Phần bù của xác suất có điều kiện',
      eq: `${condLatex(xNode, gNode, colorOf)} = 1 - ${condLatex(cv.complementNode, gNode, colorOf)} = 1 - ${fmtNum(cv.from)} = ${fmtNum(cv.numeric)}`,
    });
  }

  function solve(rawNode, ctx, colorOf) {
    const node = flatten(rawNode);
    const key = canonicalKey(node);
    if (cache.has(key)) return cache.get(key);
    if (inProgress.has(key)) {
      cuts++;
      return { numeric: null, latex: toProbLatex(node, colorOf), compound: false };
    }
    inProgress.add(key);
    const cutsBefore = cuts;
    let result;
    try { result = solveNode(node, key, ctx, colorOf); } finally { inProgress.delete(key); }
    // An "unresolved" that was only reached because a cycle was cut may be
    // perfectly resolvable by another route, so it is not remembered.
    if (!(result.numeric == null && cuts !== cutsBefore)) remember(key, result);
    return result;
  }

  // ---- rules ---------------------------------------------------------
  // Inclusion-exclusion for 3 or 4 sets as ONE formula, when every
  // intersection can be found; the pairwise recursion below stays as the
  // fallback for what cannot (and for 5+ sets, where the full formula would
  // be unreadably long).
  function tryFlatInclusionExclusion(node, ctx, colorOf) {
    const k = node.args.length;
    if (k < 3 || k > 4) return null;
    const snap = snapshot();
    const terms = [];
    for (let mask = 1; mask < (1 << k); mask++) {
      const sub = node.args.filter((_, i) => (mask >> i) & 1);
      const subNode = sub.length === 1 ? sub[0] : flatten({ type: 'INTERSECT', args: sub });
      const r = solve(subNode, ctx, colorOf);
      if (r.numeric == null) {
         rollback(snap);
         return null;
      }
      terms.push({ size: sub.length, node: subNode, value: r.numeric });
    }
    terms.sort((a, b) => a.size - b.size);
    const sign = t => (t.size % 2 ? '+' : '-');
    const numeric = terms.reduce((s, t) => s + (t.size % 2 ? t.value : -t.value), 0);
    const sym = terms.map((t, i) => (i === 0 ? '' : ` ${sign(t)} `) + toProbLatex(t.node, colorOf)).join('');
    const num = terms.map((t, i) => (i === 0 ? '' : ` ${sign(t)} `) + fmtNum(t.value)).join('');
    steps.push({
      rule: 'Nguyên lý bù trừ (Inclusion–Exclusion)',
      eq: `\\begin{aligned}${toProbLatex(node, colorOf)} &= ${sym} \\\\ &= ${num} \\\\ &= ${fmtNum(numeric)}\\end{aligned}`,
    });
    return { numeric, latex: fmtNum(numeric), compound: false };
  }

  // P(E|F) = 1 - P(Ē|F)
  function tryComplementCond(node, ctx, colorOf) {
    const cv = condValue(node.arg, node.given, ctx);
    if (!cv || cv.via !== 'complement') return null;
    explainCond(cv, node.arg, node.given, colorOf);
    return { numeric: cv.numeric, latex: fmtNum(cv.numeric), compound: false };
  }

  // P(X) = 1 - P(X') when the complement is a given fact
  function tryReverseComplement(node, ctx, colorOf) {
    if (node.type === 'COMPLEMENT' || node.type === 'COND') return null;
    const c = complementOf(node);
    const ck = canonicalKey(c);
    if (!ctx.knownProb.has(ck)) return null;
    const v = ctx.knownProb.get(ck), numeric = 1 - v;
    steps.push({ rule: 'Quy tắc phần bù', eq: `${toProbLatex(node, colorOf)} = 1 - ${toProbLatex(c, colorOf)} = 1 - ${fmtNum(v)} = ${fmtNum(numeric)}` });
    return { numeric, latex: fmtNum(numeric), compound: false };
  }

  // The last member of a declared partition is whatever the others leave out
  function tryPartitionCompletion(node, ctx, colorOf) {
    if (node.type !== 'ATOM') return null;
    for (const part of partitionsOf(ctx)) {
      if (!part.includes(node.name) || part.length < 2) continue;
      const snap = snapshot();
      const others = part.filter(n => n !== node.name).map(n => ({ n, node: { type: 'ATOM', name: n } }));
      const solved = others.map(o => solve(o.node, ctx, colorOf));
      if (solved.every(s => s.numeric != null)) {
        const numeric = 1 - solved.reduce((s, r) => s + r.numeric, 0);
        steps.push({
          rule: 'Phân hoạch phủ kín không gian mẫu',
          eq: `${toProbLatex(node, colorOf)} = 1 - ${others.map(o => toProbLatex(o.node, colorOf)).join(' - ')} = 1 - ${solved.map(s => fmtNum(s.numeric)).join(' - ')} = ${fmtNum(numeric)}`,
        });
        return { numeric, latex: fmtNum(numeric), compound: false };
      }
      rollback(snap);
    }
    return null;
  }

  // P(X) = sum P(X|Bj) P(Bj) over a declared partition, or over {G, Ḡ} for a
  // conditioning event G whose two conditionals are both known.
  function tryTotalProbability(node, key, ctx, colorOf) {
    const render = (rule, parts) => {
      const numeric = parts.reduce((s, t) => s + t.cond * t.p, 0);
      const sym = parts.map(t => `${condLatex(node, t.node, colorOf)}${toProbLatex(t.node, colorOf)}`).join(' + ');
      const prod = parts.map(t => `${fmtNum(t.cond)} \\cdot ${fmtNum(t.p)}`).join(' + ');
      const vals = parts.map(t => fmtNum(t.cond * t.p)).join(' + ');
      steps.push({ rule, eq: `\\begin{aligned}${toProbLatex(node, colorOf)} &= ${sym} \\\\ &= ${prod} \\\\ &= ${vals} = ${fmtNum(numeric)}\\end{aligned}` });
      return { numeric, latex: fmtNum(numeric), compound: false };
    };
    const attempt = (nodes, rule) => {
      const snap = snapshot();
      const parts = [];
      for (const g of nodes) {
        const cv = condValue(node, g, ctx);
        if (!cv) { rollback(snap); return null; }
        const p = solve(g, ctx, colorOf);
        if (p.numeric == null) {
           rollback(snap);
           return null;
        }
        explainCond(cv, node, g, colorOf);
        parts.push({ node: g, cond: cv.numeric, p: p.numeric });
      }
      return render(rule, parts);
    };

    for (const part of partitionsOf(ctx)) {
      if (part.includes(key)) continue;     // a member is not expanded over its own partition
      const r = attempt(part.map(n => ({ type: 'ATOM', name: n })), 'Công thức xác suất toàn phần');
      if (r) return r;
    }

    // implicit partition {G, Ḡ}: any event and its complement
    const ownKeys = new Set([key, canonicalKey(complementOf(node))]);
    const givens = new Set();
    for (const k of ctx.knownProb.keys()) {
      const i = k.indexOf('|');
      if (i > 0 && ownKeys.has(k.slice(0, i))) givens.add(k.slice(i + 1));
    }
    const seen = new Set();
    for (const gk of givens) {
      let g;
      try { g = flatten(parseCanonicalKey(gk)); } catch (e) { continue; }
      const gc = complementOf(g);
      const pairId = [canonicalKey(g), canonicalKey(gc)].sort().join('#');
      if (seen.has(pairId) || ownKeys.has(canonicalKey(g))) continue;
      seen.add(pairId);
      const r = attempt([g, gc], 'Công thức xác suất toàn phần (phân hoạch {E, Ē})');
      if (r) return r;
    }
    return null;
  }

  // Independent X and Y, one of them known, and either P(X∩Y) or P(X∪Y) given:
  // solve for the other one. P(X∩Y) = P(X)P(Y) gives P(X) = P(X∩Y)/P(Y);
  // P(X∪Y) = P(X) + P(Y) - P(X)P(Y) gives P(X) = (P(X∪Y) - P(Y)) / (1 - P(Y)).
  function tryIndependentInverse(node, ctx, colorOf) {
    if (node.type !== 'ATOM') return null;
    for (const grp of ctx.independentGroups) {
      if (!grp.has(canonicalKey(node))) continue;
      for (const yk of grp) {
        if (yk === canonicalKey(node)) continue;
        let y;
        try { y = flatten(parseCanonicalKey(yk)); } catch (e) { continue; }
        const inter = flatten({ type: 'INTERSECT', args: [node, y] });
        const union = flatten({ type: 'UNION', args: [node, y] });
        const known = ctx.knownProb.has(canonicalKey(inter)) ? 'inter' : (ctx.knownProb.has(canonicalKey(union)) ? 'union' : null);
        if (!known) continue;
        const snap = snapshot();
        const py = solve(y, ctx, colorOf);
        if (py.numeric == null) {
           rollback(snap);
           continue;
        }
        const fact = ctx.knownProb.get(canonicalKey(known === 'inter' ? inter : union));
        const X = toProbLatex(node, colorOf), Y = toProbLatex(y, colorOf);
        if (known === 'inter') {
          if (py.numeric === 0) {
             rollback(snap);
             continue;
          }
          const numeric = fact / py.numeric;
          steps.push({ rule: 'Độc lập (suy ngược)', eq: `\\begin{aligned}${toProbLatex(inter, colorOf)} &= ${X}${Y} \\\\ \\Rightarrow ${X} &= \\dfrac{${toProbLatex(inter, colorOf)}}{${Y}} = \\dfrac{${fmtNum(fact)}}{${fmtNum(py.numeric)}} = ${fmtNum(numeric)}\\end{aligned}` });
          return { numeric, latex: fmtNum(numeric), compound: false };
        }
        if (py.numeric === 1) {
           rollback(snap);
           continue;
        }
        const numeric = (fact - py.numeric) / (1 - py.numeric);
        steps.push({ rule: 'Độc lập (suy ngược)', eq: `\\begin{aligned}${toProbLatex(union, colorOf)} &= ${X} + ${Y} - ${X}${Y} \\\\ \\Rightarrow ${X} &= \\dfrac{${toProbLatex(union, colorOf)} - ${Y}}{1 - ${Y}} = \\dfrac{${fmtNum(fact)} - ${fmtNum(py.numeric)}}{1 - ${fmtNum(py.numeric)}} = ${fmtNum(numeric)}\\end{aligned}` });
        return { numeric, latex: fmtNum(numeric), compound: false };
      }
    }
    return null;
  }

  // P(E|A): Bayes over a declared partition containing E, else over {E, Ē}
  function tryBayes(node, ctx, colorOf) {
    const { arg, given } = node;
    const argKey = canonicalKey(arg), givenKey = canonicalKey(given);
    const candidates = [];
    for (const part of partitionsOf(ctx)) {
      if (part.includes(argKey) && !part.includes(givenKey)) {
        candidates.push({ nodes: part.map(n => ({ type: 'ATOM', name: n })), rule: 'Định lý Bayes', declared: true });
        break;
      }
    }
    candidates.push({ nodes: [arg, complementOf(arg)], rule: 'Định lý Bayes (phân hoạch {E, Ē})', declared: false });

    for (const cand of candidates) {
      const snap = snapshot();
      const terms = [];
      let ok = true;
      for (const n of cand.nodes) {
        let cond;
        const cv = condValue(given, n, ctx);
        if (cv) { explainCond(cv, given, n, colorOf); cond = cv.numeric; }
        else if (cand.declared) cond = solve({ type: 'COND', arg: given, given: n }, ctx, colorOf).numeric;
        else cond = null;
        const p = solve(n, ctx, colorOf).numeric;
        if (cond == null || p == null) { ok = false; break; }
        terms.push({ node: n, cond, p, product: cond * p });
      }
      const idx = cand.nodes.findIndex(n => canonicalKey(n) === argKey);
      const denom = ok ? terms.reduce((s, t) => s + t.product, 0) : 0;
      if (!ok || idx < 0 || denom === 0) { rollback(snap); continue; }
      const target = terms[idx];
      const numeric = target.product / denom;
      const sumSym = terms.map(t => `${condLatex(given, t.node, colorOf)}${toProbLatex(t.node, colorOf)}`).join(' + ');
      const sumNum = terms.map(t => `${fmtNum(t.cond)} \\cdot ${fmtNum(t.p)}`).join(' + ');
      steps.push({
        rule: cand.rule,
        eq: `\\begin{aligned}${condLatex(arg, given, colorOf)} &= \\dfrac{${condLatex(given, arg, colorOf)}${toProbLatex(arg, colorOf)}}{${sumSym}} \\\\` +
          ` &= \\dfrac{${fmtNum(target.cond)} \\cdot ${fmtNum(target.p)}}{${sumNum}} \\\\ &= \\dfrac{${fmtNum(target.product)}}{${fmtNum(denom)}} = ${fmtNum(numeric)}\\end{aligned}`,
      });
      return { numeric, latex: fmtNum(numeric), compound: false };
    }
    return null;
  }

  // ---- the solver proper ---------------------------------------------
  function solveNode(node, key, ctx, colorOf) {
    if (node.type === 'EMPTY') return { numeric: 0, latex: '0', compound: false };
    if (node.type === 'UNIVERSE') return { numeric: 1, latex: '1', compound: false };
    if (ctx.knownProb.has(key)) {
      const v = ctx.knownProb.get(key);
      return { numeric: v, latex: fmtNum(v), compound: false };
    }

    let result = null;

    if (node.type === 'COMPLEMENT') {
      const inner = solve(node.arg, ctx, colorOf);
      const numeric = inner.numeric != null ? 1 - inner.numeric : null;
      const latex = numeric != null ? fmtNum(numeric) : `1 - ${wrapIfCompound(inner)}`;
      steps.push({
        rule: 'Quy tắc phần bù',
        eq: `${toProbLatex(node, colorOf)} = 1 - ${toProbLatex(node.arg, colorOf)}` +
          (inner.numeric != null ? ` = 1 - ${fmtNum(inner.numeric)} = ${fmtNum(numeric)}` : '')
      });
      result = { numeric, latex, compound: numeric == null };
    }

    else if (node.type === 'UNION' && node.args.length >= 2) {
      result = tryFlatInclusionExclusion(node, ctx, colorOf);
      if (!result) {
        const [first, ...rest] = node.args;
        const restNode = rest.length === 1 ? rest[0] : flatten({ type: 'UNION', args: rest });
        const interNode = distributeIntersect(first, restNode);
        steps.push({
          rule: 'Nguyên lý bù trừ (Inclusion–Exclusion)',
          eq: `${toProbLatex(node, colorOf)} = ${toProbLatex(first, colorOf)} + ${toProbLatex(restNode, colorOf)} - ${toProbLatex(interNode, colorOf)}`
        });
        const a = solve(first, ctx, colorOf);
        const b = solve(restNode, ctx, colorOf);
        const c = solve(interNode, ctx, colorOf);
        const numeric = (a.numeric != null && b.numeric != null && c.numeric != null) ? a.numeric + b.numeric - c.numeric : null;
        const latex = numeric != null ? fmtNum(numeric) : `${a.latex} + ${b.latex} - ${wrapIfCompound(c)}`;
        result = { numeric, latex, compound: numeric == null };
      }
    }

    else if (node.type === 'INTERSECT' && node.args.length >= 2) {
      const args = node.args;
      let mutexHit = false;
      outer:
      for (let i = 0; i < args.length; i++) {
        for (let j = i + 1; j < args.length; j++) {
          const ki = canonicalKey(args[i]), kj = canonicalKey(args[j]);
          if (ctx.mutexPairs.has(pairKey(ki, kj))) {
            steps.push({
              rule: 'Xung khắc (mutually exclusive)',
              eq: `${toProbLatex({ type: 'INTERSECT', args: [args[i], args[j]] }, colorOf)} = 0 \\Rightarrow ${toProbLatex(node, colorOf)} = 0`
            });
            mutexHit = true;
            break outer;
          }
        }
      }
      if (mutexHit) {
        result = { numeric: 0, latex: '0', compound: false };
      } else {
        const keys = args.map(canonicalKey);
        const unionIdx = args.findIndex(a => a.type === 'UNION');
        if (args.length >= 2 && inSameIndependentGroup(keys, ctx)) {
          const solved = args.map(a => solve(a, ctx, colorOf));
          const numeric = solved.every(s => s.numeric != null) ? solved.reduce((p, s) => p * s.numeric, 1) : null;
          const rhsSym = args.map(a => toProbLatex(a, colorOf)).join(' \\cdot ');
          steps.push({
            rule: 'Độc lập (independent events)',
            eq: `${toProbLatex(node, colorOf)} = ${rhsSym}` + (numeric != null ? ` = ${solved.map(s => fmtNum(s.numeric)).join(' \\cdot ')} = ${fmtNum(numeric)}` : '')
          });
          result = { numeric, latex: numeric != null ? fmtNum(numeric) : rhsSym, compound: false };
        } else if (unionIdx !== -1) {
          const unionArg = args[unionIdx];
          const others = args.filter((_, i) => i !== unionIdx);
          const distributed = flatten({
            type: 'UNION',
            args: unionArg.args.map(u => flatten({ type: 'INTERSECT', args: [...others, u] }))
          });
          steps.push({
            rule: 'Luật phân phối (giao phân phối trên hợp)',
            eq: `${toProbLatex(node, colorOf)} = ${toProbLatex(distributed, colorOf)}`
          });
          result = solve(distributed, ctx, colorOf);
        } else {
          const negFactors = [], posFactors = [];
          for (const a of args) {
             if (a.type === 'COMPLEMENT') negFactors.push(a.arg);
             else posFactors.push(a);
          }
          // General conditional-probability split: try every way to
          // partition the args into two non-empty groups G1 | G2 and look
          // for a given P(G2|G1) or P(G1|G2). This covers the plain pairwise
          // case (n=2) and also n>=3 facts framed around a compound
          // condition or a compound conditioned event, e.g. P(C∩D | A) or
          // P(D | B∩C) feeding into a 3-way or 4-way intersection. A given
          // that is only the complement of the one needed (P(Ā|B) for
          // P(A|B)) counts too, but a stated conditional is preferred.
          const findSplit = allowComplement => {
            const n = args.length;
            for (let mask = 1; mask < (1 << n) - 1; mask++) {
              const comp = ((1 << n) - 1) ^ mask;
              if (mask > comp) continue;
              const g1 = args.filter((_, i) => (mask >> i) & 1);
              const g2 = args.filter((_, i) => (comp >> i) & 1);
              const g1Node = flatten(g1.length === 1 ? g1[0] : { type: 'INTERSECT', args: g1 });
              const g2Node = flatten(g2.length === 1 ? g2[0] : { type: 'INTERSECT', args: g2 });
              const a = condValue(g2Node, g1Node, ctx), b = condValue(g1Node, g2Node, ctx);
              const usable = cv => cv && (allowComplement || cv.via === 'direct');
              if (usable(a)) return { given: g1Node, target: g2Node, cv: a };
              if (usable(b)) return { given: g2Node, target: g1Node, cv: b };
            }
            return null;
          };
          const split = hasCondFacts(ctx) && args.length <= 8 ? (findSplit(false) || findSplit(true)) : null;
          if (split) {
            const snap = snapshot();
            explainCond(split.cv, split.target, split.given, colorOf);
            const pg = solve(split.given, ctx, colorOf);
            if (pg.numeric != null || !negFactors.length) {
              const numeric = (pg.numeric != null) ? split.cv.numeric * pg.numeric : null;
              steps.push({
                rule: 'Định nghĩa xác suất có điều kiện',
                eq: `${toProbLatex(node, colorOf)} = ${condLatex(split.target, split.given, colorOf)} \\cdot ${toProbLatex(split.given, colorOf)}` +
                  (numeric != null ? ` = ${fmtNum(split.cv.numeric)} \\cdot ${fmtNum(pg.numeric)} = ${fmtNum(numeric)}` : '')
              });
              result = { numeric, latex: numeric != null ? fmtNum(numeric) : `${fmtNum(split.cv.numeric)} \\cdot ${wrapIfCompound(pg)}`, compound: false };
            } else {
              rollback(snap);
            }
          }
          if (!result && negFactors.length > 0) {
            const X = posFactors.length === 0 ? { type: 'UNIVERSE' } : (posFactors.length === 1 ? posFactors[0] : flatten({ type: 'INTERSECT', args: posFactors }));
            const Y = negFactors.length === 1 ? negFactors[0] : flatten({ type: 'UNION', args: negFactors });
            const XYnode = flatten({ type: 'INTERSECT', args: [X, Y] });
            steps.push({
              rule: 'Hiệu tập hợp (phần bù tương đối)',
              eq: `${toProbLatex(node, colorOf)} = ${toProbLatex(X, colorOf)} - ${toProbLatex(XYnode, colorOf)}`
            });
            const sx = solve(X, ctx, colorOf);
            const sxy = solve(XYnode, ctx, colorOf);
            const numeric = (sx.numeric != null && sxy.numeric != null) ? sx.numeric - sxy.numeric : null;
            result = { numeric, latex: numeric != null ? fmtNum(numeric) : `${sx.latex} - ${wrapIfCompound(sxy)}`, compound: numeric == null };
          }
        }
      }
    }

    else if (node.type === 'COND') {
      const { arg, given } = node;
      result = tryComplementCond(node, ctx, colorOf) || tryBayes(node, ctx, colorOf);
      if (!result) {
        const interNode = flatten({ type: 'INTERSECT', args: [arg, given] });
        const num = solve(interNode, ctx, colorOf);
        const den = solve(given, ctx, colorOf);
        const numeric = (num.numeric != null && den.numeric != null && den.numeric !== 0) ? num.numeric / den.numeric : null;
        steps.push({
          rule: 'Định nghĩa xác suất có điều kiện',
          eq: `P\\left(${toLatex(arg, colorOf)} \\mid ${toLatex(given, colorOf)}\\right) = \\dfrac{${toProbLatex(interNode, colorOf)}}{${toProbLatex(given, colorOf)}}` +
            (numeric != null ? ` = \\dfrac{${fmtNum(num.numeric)}}{${fmtNum(den.numeric)}} = ${fmtNum(numeric)}` : '')
        });
        // A fraction's bar already delimits numerator and denominator, so
        // num.latex/den.latex never need extra wrapping here even when compound.
        result = { numeric, latex: numeric != null ? fmtNum(numeric) : `\\dfrac{${num.latex}}{${den.latex}}`, compound: false };
      }
    }

    if (!result || result.numeric == null) {
      const alt = tryReverseComplement(node, ctx, colorOf) || tryIndependentInverse(node, ctx, colorOf) || tryPartitionCompletion(node, ctx, colorOf) || tryTotalProbability(node, key, ctx, colorOf);
      if (alt) result = alt;
    }

    if (!result) {
      if (node.type === 'ATOM') missing.add(node.name);
      result = { numeric: null, latex: toProbLatex(node, colorOf), compound: false };
    }
    return result;
  }

  return { solve, steps, missing, cache };
}
