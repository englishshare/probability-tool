/* ============================================================
   SOLVER: memoized rule-based recursive solver (step-by-step derivations)
   ============================================================ */

// ---------- SOLVER ----------
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

function makeSolver() {
  const cache = new Map();
  const steps = [];
  const missing = new Set();

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

  function solve(rawNode, ctx, colorOf) {
    const node = flatten(rawNode);
    const key = canonicalKey(node);
    if (cache.has(key)) return cache.get(key);

    if (node.type === 'EMPTY') { const r = { numeric: 0, latex: '0', compound: false }; cache.set(key, r); return r; }
    if (node.type === 'UNIVERSE') { const r = { numeric: 1, latex: '1', compound: false }; cache.set(key, r); return r; }

    if (ctx.knownProb.has(key)) {
      const v = ctx.knownProb.get(key);
      const r = { numeric: v, latex: fmtNum(v), compound: false };
      cache.set(key, r);
      return r;
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
          for (const a of args) { if (a.type === 'COMPLEMENT') negFactors.push(a.arg); else posFactors.push(a); }
          if (negFactors.length > 0) {
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
          } else {
            // General conditional-probability split: try every way to
            // partition the args into two non-empty groups G1 | G2 and look
            // for a direct hypothesis for P(G2|G1) or P(G1|G2). This covers
            // the plain pairwise case (n=2) and also n>=3 facts framed
            // around a compound condition or a compound conditioned event,
            // e.g. P(C∩D | A) or P(D | B∩C) feeding into a 3-way or 4-way
            // intersection -- not just intersections of exactly two atoms.
            const n = args.length;
            let split = null;
            for (let mask = 1; mask < (1 << n) - 1 && !split; mask++) {
              const comp = ((1 << n) - 1) ^ mask;
              if (mask > comp) continue;
              const g1 = args.filter((_, i) => (mask >> i) & 1);
              const g2 = args.filter((_, i) => (comp >> i) & 1);
              const g1Node = flatten(g1.length === 1 ? g1[0] : { type: 'INTERSECT', args: g1 });
              const g2Node = flatten(g2.length === 1 ? g2[0] : { type: 'INTERSECT', args: g2 });
              const k1 = canonicalKey(g1Node), k2 = canonicalKey(g2Node);
              if (ctx.knownProb.has(k2 + '|' + k1)) split = { given: g1Node, target: g2Node, pGiven: ctx.knownProb.get(k2 + '|' + k1) };
              else if (ctx.knownProb.has(k1 + '|' + k2)) split = { given: g2Node, target: g1Node, pGiven: ctx.knownProb.get(k1 + '|' + k2) };
            }
            if (split) {
              const pg = solve(split.given, ctx, colorOf);
              const numeric = (pg.numeric != null) ? split.pGiven * pg.numeric : null;
              steps.push({
                rule: 'Định nghĩa xác suất có điều kiện',
                eq: `${toProbLatex(node, colorOf)} = P\\left(${toLatex(split.target, colorOf)} \\mid ${toLatex(split.given, colorOf)}\\right) \\cdot ${toProbLatex(split.given, colorOf)}` +
                  (numeric != null ? ` = ${fmtNum(split.pGiven)} \\cdot ${fmtNum(pg.numeric)} = ${fmtNum(numeric)}` : '')
              });
              result = { numeric, latex: numeric != null ? fmtNum(numeric) : `${fmtNum(split.pGiven)} \\cdot ${wrapIfCompound(pg)}`, compound: false };
            }
          }
        }
      }
    }

    else if (node.type === 'COND') {
      const { arg, given } = node;
      const argKey = canonicalKey(arg);
      if (ctx.partition && ctx.partition.includes(argKey) && !ctx.partition.includes(canonicalKey(given))) {
        const terms = ctx.partition.map(aj => {
          const ajNode = { type: 'ATOM', name: aj };
          const pCond = solve({ type: 'COND', arg: given, given: ajNode }, ctx, colorOf);
          const pAj = solve(ajNode, ctx, colorOf);
          const numeric = (pCond.numeric != null && pAj.numeric != null) ? pCond.numeric * pAj.numeric : null;
          return { aj, pCond, pAj, numeric };
        });
        const denomKnown = terms.every(t => t.numeric != null);
        if (denomKnown) {
          const denom = terms.reduce((s, t) => s + t.numeric, 0);
          const target = terms.find(t => t.aj === argKey);
          const numeric = denom !== 0 ? target.numeric / denom : null;
          const sumLatex = terms.map(t => `P\\left(${toLatex(given, colorOf)}\\mid ${t.aj}\\right)P\\left(${t.aj}\\right)`).join(' + ');
          const sumNum = terms.map(t => `${fmtNum(t.pCond.numeric)} \\cdot ${fmtNum(t.pAj.numeric)}`).join(' + ');
          steps.push({
            rule: 'Định lý Bayes',
            eq: `P\\left(${argKey} \\mid ${toLatex(given, colorOf)}\\right) = \\dfrac{P\\left(${toLatex(given, colorOf)}\\mid ${argKey}\\right)P\\left(${argKey}\\right)}{${sumLatex}}` +
              ` = \\dfrac{${fmtNum(target.pCond.numeric)} \\cdot ${fmtNum(target.pAj.numeric)}}{${sumNum}} = ${fmtNum(numeric)}`
          });
          result = { numeric, latex: fmtNum(numeric), compound: false };
        }
      }
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

    if (!result && ctx.partition && ctx.partition.length) {
      const terms = ctx.partition.map(aj => {
        const condKey = key + '|' + aj;
        const pCond = ctx.knownProb.has(condKey) ? ctx.knownProb.get(condKey) : null;
        const pAj = solve({ type: 'ATOM', name: aj }, ctx, colorOf);
        const numeric = (pCond != null && pAj.numeric != null) ? pCond * pAj.numeric : null;
        return { aj, pCond, pAj, numeric };
      });
      if (terms.every(t => t.numeric != null)) {
        const numeric = terms.reduce((s, t) => s + t.numeric, 0);
        const sumSym = terms.map(t => `P\\left(${toLatex(node, colorOf)}\\mid ${t.aj}\\right)P\\left(${t.aj}\\right)`).join(' + ');
        const sumNum = terms.map(t => `${fmtNum(t.pCond)} \\cdot ${fmtNum(t.pAj.numeric)}`).join(' + ');
        steps.push({
          rule: 'Công thức xác suất toàn phần',
          eq: `${toProbLatex(node, colorOf)} = ${sumSym} = ${sumNum} = ${fmtNum(numeric)}`
        });
        result = { numeric, latex: fmtNum(numeric), compound: false };
      }
    }

    if (!result) {
      if (node.type === 'ATOM') missing.add(node.name);
      result = { numeric: null, latex: toProbLatex(node, colorOf), compound: false };
    }

    cache.set(key, result);
    return result;
  }

  return { solve, steps, missing, cache };
}
