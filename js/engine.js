/* ============================================================
   ENGINE: ties the two reasoning methods together

   1. The rule-based solver (solver.js) produces the textbook-style
      derivation -- inclusion-exclusion, Bayes, conditional definition...
   2. The linear model (linear.js) covers what rules cannot reach (running
      a fact backwards) and independently checks the facts for
      contradictions.

   Rules first because their steps read like a worked solution; the linear
   model steps in only when the rules leave the answer open.
   ============================================================ */

function solveQuery(queryNode, ctx, colorOf) {
  const node = flatten(queryNode);
  const rule = makeSolver();
  const r = rule.solve(node, ctx, colorOf);
  const atoms = [...collectAtoms(node)];
  const model = buildLinearModel(ctx, atoms);
  const out = { numeric: r.numeric, latex: r.latex, steps: rule.steps, missing: rule.missing, via: 'rule', model, atoms };

  if (out.numeric == null && model && !model.problem) {
    const lin = explainViaLinear(node, model, colorOf);
    if (lin) {
      // the rule-based steps ended unresolved, so they would only read as
      // dead ends next to the derivation that actually closes the problem
      Object.assign(out, { numeric: lin.numeric, latex: fmtNum(lin.numeric), steps: lin.steps, missing: new Set(), via: 'linear' });
    }
  }
  return out;
}

// Would these facts (plus the declarations in ctx) be contradictory? Used
// before accepting a new fact, so impossible data is refused at the door
// with a reason instead of producing a confident wrong answer later.
// Returns null when fine, otherwise a message.
function findContextProblem(ctx) {
  const model = buildLinearModel(ctx, []);
  return model && model.problem ? model.problem.text : null;
}

// Accepts a plain decimal ("0.375" or "0,375") or a simple fraction ("3/8", spaces
// around the slash allowed) -- fractions are common in these problems
// (thirds, sevenths...) and don't always have a clean decimal form.
function parseValueInput(text) {
  // Vietnamese writes decimals with a comma ("0,375"), so a comma between
  // digits counts as the decimal separator (probabilities never reach a
  // thousand, so there is no thousands-separator reading to confuse it with).
  const s = String(text).trim().replace(/(\d),(\d)/g, '$1.$2');
  const m = s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
  if (m) {
    const num = parseFloat(m[1]), den = parseFloat(m[2]);
    return den === 0 ? NaN : num / den;
  }
  return /^-?\d*\.?\d+$/.test(s) ? parseFloat(s) : NaN;
}

// "P(A) = 0.6" -> { exprPart: "P(A)", value: 0.6 } when the line looks like
// a hypothesis (an expression this tool can read, "=", then a number).
function tryLineAsHypothesis(line) {
  const idx = line.lastIndexOf('=');
  if (idx === -1) return null;
  const exprPart = line.slice(0, idx).trim();
  const value = parseValueInput(line.slice(idx + 1));
  if (!exprPart || isNaN(value) || !isFinite(value)) return null;
  try {
     flatten(parseQuery(exprPart).arg);
     return { exprPart, value };
  }
  catch (e) { return null; }
}
