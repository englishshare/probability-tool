/* ============================================================
   ALGEBRA: canonical forms, LaTeX/text rendering, number formatting
   ============================================================ */

// ---------- CANONICALIZATION ----------
function canonicalKey(node) {
  switch (node.type) {
    case 'ATOM': return node.name;
    case 'EMPTY': return '\u2205';
    case 'UNIVERSE': return '\u03A9';
    case 'COMPLEMENT': return '~' + canonicalKey(node.arg);
    case 'UNION': return '(' + node.args.map(canonicalKey).join('\u222A') + ')';
    case 'INTERSECT': return '(' + node.args.map(canonicalKey).join('\u2229') + ')';
    case 'COND': return canonicalKey(node.arg) + '|' + canonicalKey(node.given);
    default: return '?';
  }
}

function flatten(node) {
  if (node.type === 'UNION' || node.type === 'INTERSECT') {
    const isUnion = node.type === 'UNION';
    let args = [];
    for (const a of node.args) {
      const fa = flatten(a);
      if (fa.type === node.type) args.push(...fa.args);
      else args.push(fa);
    }
    const dominant = isUnion ? 'UNIVERSE' : 'EMPTY';
    const absorbed = isUnion ? 'EMPTY' : 'UNIVERSE';
    if (args.some(a => a.type === dominant)) return { type: dominant };
    args = args.filter(a => a.type !== absorbed);
    if (args.length === 0) return { type: absorbed };
    const seen = new Map();
    for (const a of args) {
       const k = canonicalKey(a);
       if (!seen.has(k)) seen.set(k, a);
    }
    args = [...seen.values()];
    if (args.length === 1) return args[0];
    args.sort((x, y) => canonicalKey(x) < canonicalKey(y) ? -1 : canonicalKey(x) > canonicalKey(y) ? 1 : 0);
    return { type: node.type, args };
  }
  if (node.type === 'COMPLEMENT') {
    const inner = flatten(node.arg);
    if (inner.type === 'COMPLEMENT') return flatten(inner.arg);
    if (inner.type === 'EMPTY') return { type: 'UNIVERSE' };
    if (inner.type === 'UNIVERSE') return { type: 'EMPTY' };
    return { type: 'COMPLEMENT', arg: inner };
  }
  if (node.type === 'COND') return { type: 'COND', arg: flatten(node.arg), given: flatten(node.given) };
  return node;
}

function pairKey(k1, k2) { return [k1, k2].sort().join(' ~ '); }

// ---------- LATEX RENDERING ----------
function toLatex(node, colorOf) {
  function wrap(name, s) {
    const c = colorOf && colorOf(name);
    return c ? `{\\color{${c}}{${s}}}` : s;
  }
  function rec(n, parentPrec) {
    switch (n.type) {
      case 'ATOM': return wrap(n.name, n.name);
      case 'EMPTY': return '\\emptyset';
      case 'UNIVERSE': return '\\Omega';
      case 'COMPLEMENT': return `\\overline{${rec(n.arg, 0)}}`;
      case 'UNION': {
        const s = n.args.map(a => rec(a, 1)).join(' \\cup ');
        return parentPrec > 1 ? `\\left(${s}\\right)` : s;
      }
      case 'INTERSECT': {
        const s = n.args.map(a => rec(a, 2)).join(' \\cap ');
        return parentPrec > 2 ? `\\left(${s}\\right)` : s;
      }
      case 'COND': return `${rec(n.arg, 0)} \\mid ${rec(n.given, 0)}`;
      default: return '?';
    }
  }
  return rec(node, 0);
}
function toProbLatex(node, colorOf) { return `P\\left(${toLatex(node, colorOf)}\\right)`; }

function fmtNum(x) {
  if (x === null || x === undefined) return '?';
  const r = Math.round(x * 1e6) / 1e6;
  return String(r);
}

// Serializes a set expression back to text this tool's own parser reads
// (∪ ∩ ' |), so one function covers both screen-reader labels and what is
// saved between visits -- a saved hypothesis has to survive a round trip
// through parseQuery unchanged, or reopening the page would silently
// change the problem.
function exprToText(node) {
  switch (node.type) {
    case 'ATOM': return node.name;
    case 'EMPTY': return '∅';
    case 'UNIVERSE': return 'Ω';
    case 'COMPLEMENT': return node.arg.type === 'ATOM' ? node.arg.name + "'" : '(' + exprToText(node.arg) + ")'";
    case 'UNION': return node.args.map(a => exprToText(a)).join(' ∪ ');
    case 'INTERSECT': return node.args.map(a => (a.type === 'UNION' ? '(' + exprToText(a) + ')' : exprToText(a))).join(' ∩ ');
    case 'COND': return exprToText(node.arg) + ' | ' + exprToText(node.given);
    default: return '?';
  }
}

// Best small-denominator fraction for x via continued fractions, so a
// result like 0.2142857 can also be read as 3/14. Reports whether the match
// is exact (to float noise) or only approximate -- inputs given as
// six-digit decimals rarely land exactly on the "nice" fraction behind them.
function bestFraction(x, maxDen) {
  maxDen = maxDen || 1000;
  if (!isFinite(x) || x < 0 || x > 1) return null;
  if (x === 0) return { p: 0, q: 1, exact: true };
  let h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = x;
  for (let i = 0; i < 40; i++) {
    const a = Math.floor(b);
    const h2 = a * h1 + h0, k2 = a * k1 + k0;
    if (k2 > maxDen) break;
    h0 = h1; h1 = h2; k0 = k1; k1 = k2;
    const frac = b - a;
    if (Math.abs(x - h1 / k1) < 1e-12 || frac < 1e-12) break;
    b = 1 / frac;
  }
  if (k1 === 0) return null;
  const err = Math.abs(x - h1 / k1);
  if (err > 1e-6) return null;
  return { p: h1, q: k1, exact: err < 1e-9 };
}

// Inverse of canonicalKey (algebra.js): lets a fact stored by key be turned
// back into a set expression.
function parseCanonicalKey(key) {
  let i = 0;
  function expr() {
    const c = key[i];
    if (c === '~') {
       i++;
       return { type: 'COMPLEMENT', arg: expr() };
    }
    if (c === '(') {
      i++;
      const args = [expr()];
      let op = null;
      while (key[i] === '∪' || key[i] === '∩') {
         op = key[i];
         i++;
         args.push(expr());
      }
      if (key[i] !== ')') throw new Error('bad key: ' + key);
      i++;
      return op ? { type: op === '∪' ? 'UNION' : 'INTERSECT', args } : args[0];
    }
    if (c === '∅') {
       i++;
       return { type: 'EMPTY' };
    }
    if (c === 'Ω') {
       i++; return { type: 'UNIVERSE' };
    }
    let j = i;
    while (j < key.length && '()∪∩~|'.indexOf(key[j]) === -1) j++;
    if (j === i) throw new Error('bad key: ' + key);
    const name = key.slice(i, j); i = j;
    return { type: 'ATOM', name };
  }
  const a = expr();
  if (key[i] === '|') { i++; const b = expr(); return { type: 'COND', arg: a, given: b }; }
  if (i !== key.length) throw new Error('bad key: ' + key);
  return a;
}
