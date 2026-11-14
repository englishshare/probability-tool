/* ============================================================
   PARSER: tokenizer + recursive-descent parser for set/probability expressions
   ============================================================ */

// ---------- TOKENIZER ----------
function tokenize(src) {
  const toks = [];
  let i = 0;
  const isLetter = c => /[A-Za-z]/.test(c);
  const isDigit = c => /[0-9]/.test(c);
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '\\') {
      const rest = src.slice(i);
      const cmds = [
        ['\\cup', 'UNION'], ['\\cap', 'INTERSECT'], ['\\setminus', 'DIFF'],
        ['\\overline{', 'OVERLINE_OPEN'], ['\\emptyset', 'EMPTY'], ['\\varnothing', 'EMPTY'],
        ['\\Omega', 'UNIVERSE'], ['\\mid', 'PIPE'], ['\\vert', 'PIPE'],
        ['\\left(', 'LPAREN'], ['\\right)', 'RPAREN'],
        ['\\left|', 'PIPE'], ['\\right|', 'PIPE'],
        ['\\bar{', 'OVERLINE_OPEN'],
      ];
      let matched = false;
      for (const [pat, type] of cmds) {
        if (rest.startsWith(pat)) { toks.push({ type }); i += pat.length; matched = true; break; }
      }
      if (matched) continue;
      const named = rest.match(/^\\([A-Za-z]+)/);
      if (named) {
        // layout-only commands change nothing about the meaning
        if (['left', 'right', 'displaystyle', 'textstyle', 'quad', 'qquad', 'big', 'Big', 'bigl', 'bigr', 'Bigl', 'Bigr'].includes(named[1])) { i += named[0].length; continue; }
        throw new Error('Lỗi cú pháp: lệnh LaTeX \\' + named[1] + ' chưa được hỗ trợ.');
      }
      if (/^\\[,;:! ]/.test(rest) && rest[1] !== ' ') { i += 2; continue; }   // LaTeX spacing
      toks.push({ type: 'DIFF' });                                              // a bare "\" is set difference
      i++;
      continue;
    }
    if (c === '{') { toks.push({ type: 'LBRACE' }); i++; continue; }
    if (c === '}') { toks.push({ type: 'RBRACE' }); i++; continue; }
    if (c === '(') { toks.push({ type: 'LPAREN' }); i++; continue; }
    if (c === ')') { toks.push({ type: 'RPAREN' }); i++; continue; }
    if (c === "'") { toks.push({ type: 'PRIME' }); i++; continue; }
    if (c === '^') {
      let j = i + 1;
      if (src[j] === '{') {
        j++;
        let inner = '';
        while (j < src.length && src[j] !== '}') { inner += src[j]; j++; }
        j++;
        if (inner.trim() === 'c' || inner.trim() === 'C') { toks.push({ type: 'PRIME' }); i = j; continue; }
      } else if (src[j] === 'c' || src[j] === 'C') {
        toks.push({ type: 'PRIME' }); i = j + 1; continue;
      }
      throw new Error('Lỗi cú pháp: dấu ^ chỉ dùng cho phần bù ^c hoặc ^{c}.');
    }
    if (c === '$') { i++; continue; }                         // LaTeX math delimiters
    if (c === '∪' || c === '⋃') { toks.push({ type: 'UNION' }); i++; continue; }
    if (c === '∖') { toks.push({ type: 'DIFF' }); i++; continue; }
    if (c === '′' || c === '’') { toks.push({ type: 'PRIME' }); i++; continue; }
    if (c === '∣') { toks.push({ type: 'PIPE' }); i++; continue; }
    if (c === '∩' || c === '⋂') { toks.push({ type: 'INTERSECT' }); i++; continue; }
    if (c === '∅') { toks.push({ type: 'EMPTY' }); i++; continue; }
    if (c === 'Ω') { toks.push({ type: 'UNIVERSE' }); i++; continue; }
    if (c === '\u0027') { toks.push({ type: 'PRIME' }); i++; continue; }
    if (c === '|') { toks.push({ type: 'PIPE' }); i++; continue; }
    if (c === ',') { toks.push({ type: 'COMMA' }); i++; continue; }
    if (c === '=') { toks.push({ type: 'EQUALS' }); i++; continue; }
    if (c === '%') { toks.push({ type: 'PERCENT' }); i++; continue; }
    if (isDigit(c) || (c === '.' && isDigit(src[i + 1]))) {
      let j = i, s = '';
      while (j < src.length && (isDigit(src[j]) || src[j] === '.')) { s += src[j]; j++; }
      toks.push({ type: 'NUMBER', value: parseFloat(s) });
      i = j; continue;
    }
    if (isLetter(c)) {
      let j = i, s = '';
      while (j < src.length && isLetter(src[j])) { s += src[j]; j++; }
      if (s === 'U' || s === 'u') { toks.push({ type: 'UNION' }); i = j; continue; }
      // A capital "N" standing alone between two operands ("A N B") is the
      // usual way to type the intersection sign in capitals; but "N" can also
      // just be a set's name, so it only counts as the operator when there is
      // an operand on both sides -- "P(N)" and "P(A N)" keep it as a name.
      if (s === 'N') {
        const last = toks[toks.length - 1];
        const operandBefore = last && ['ATOM', 'RPAREN', 'PRIME', 'RBRACE', 'EMPTY', 'UNIVERSE'].includes(last.type);
        const after = src.slice(j).match(/^\s*(\S)/);
        const operandAfter = after && /[A-Za-z(\\∅Ω]/.test(after[1]);
        if (operandBefore && operandAfter) { toks.push({ type: 'INTERSECT' }); i = j; continue; }
      }
      if (s === 'n') { toks.push({ type: 'INTERSECT' }); i = j; continue; }
      if (s === 'P') { toks.push({ type: 'PFUNC' }); i = j; continue; }
      if (s.toLowerCase() === 'cup') { toks.push({ type: 'UNION' }); i = j; continue; }
      if (s.toLowerCase() === 'cap') { toks.push({ type: 'INTERSECT' }); i = j; continue; }
      if (s === 'omega' || s === 'Omega') { toks.push({ type: 'UNIVERSE' }); i = j; continue; }
      let k = j;
      while (k < src.length && isDigit(src[k])) { k++; }
      const trailingDigits = src.slice(j, k);
      // A run of several letters that isn't one of the keywords above is
      // read as several one-letter sets with an *implicit* intersection
      // between them -- "AB" means A∩B, the common textbook shorthand
      // "P(AB)" for P(A∩B). Only the last letter absorbs any trailing
      // digits, so "B1" still names one set, not "B" intersected with "1".
      //
      // "U"/"u" (union) and "n" (intersection) are reserved operators, not set
      // names, and that has to hold *inside* a run too: text with no spaces
      // -- which is what OCR always produces, since a gap between glyphs
      // leaves no ink to recognize -- turns "D U A" into "DUA", and that
      // must still read as D ∪ A rather than as three sets D, U and A.
      let prevWasAtom = false;
      for (let idx = i; idx < j; idx++) {
        const letter = src[idx];
        if (letter === 'U' || letter === 'u') { toks.push({ type: 'UNION' }); prevWasAtom = false; continue; }
        if (letter === 'n') { toks.push({ type: 'INTERSECT' }); prevWasAtom = false; continue; }
        if (prevWasAtom) toks.push({ type: 'INTERSECT' });
        const isLast = idx === j - 1;
        toks.push({ type: 'ATOM', name: letter + (isLast ? trailingDigits : '') });
        prevWasAtom = true;
      }
      i = k; continue;
    }
    // Anything else is a symbol this tool does not understand. Quietly
    // skipping it used to turn "A|~B" into "A|B" and "A + B" into A∩B --
    // a different problem solved without a word -- so say so instead.
    const hints = {
      '+': 'dùng U (hoặc ∪) cho phép hợp', '&': 'dùng n (hoặc ∩) cho phép giao', '*': 'dùng n (hoặc ∩) cho phép giao',
      '×': 'dùng n (hoặc ∩) cho phép giao', '·': 'dùng n (hoặc ∩) cho phép giao', '-': "dùng \\ cho hiệu A \\ B, hoặc A n B'",
      '~': "dùng dấu ' sau tên tập cho phần bù, ví dụ B'", '!': "dùng dấu ' sau tên tập cho phần bù", '¬': "dùng dấu ' sau tên tập cho phần bù",
      '[': 'dùng ngoặc tròn ( )', ']': 'dùng ngoặc tròn ( )', '/': 'phân số chỉ dùng ở ô giá trị, ví dụ 3/8',
    };
    throw new Error('Lỗi cú pháp: ký tự "' + c + '" không được hỗ trợ' + (hints[c] ? ' — ' + hints[c] : '') + '.');
  }
  return toks;
}

// ---------- PARSER ----------
// Grammar, lowest to highest precedence:
//   condExpr  := unionExpr (PIPE unionExpr)?
//   unionExpr := interExpr (UNION interExpr)*
//   interExpr := complExpr ((INTERSECT | DIFF)? complExpr)*   // adjacency = implicit ∩
//   complExpr := primary PRIME*
//   primary   := LPAREN condExpr RPAREN | OVERLINE_OPEN condExpr RBRACE | ATOM | EMPTY | UNIVERSE
//
// There used to be two near-identical copies of this (one reading a string,
// one reading an already-sliced token array); every fix had to be made twice
// and the copies drifted. This is the single implementation both go through.
function parseTokens(toks, where) {
  where = where || '';
  let pos = 0;
  const peek = () => toks[pos];
  const next = () => toks[pos++];
  const fail = msg => { throw new Error('Lỗi cú pháp' + where + ': ' + msg); };
  const startsPrimary = t => !!t && (t.type === 'ATOM' || t.type === 'LPAREN' || t.type === 'OVERLINE_OPEN' || t.type === 'EMPTY' || t.type === 'UNIVERSE');
  function expect(type) {
    if (!peek() || peek().type !== type) fail('mong đợi ' + type + ' nhưng gặp ' + (peek() ? peek().type : 'EOF'));
    return next();
  }
  function parsePrimary() {
    const t = peek();
    if (!t) fail('biểu thức kết thúc bất ngờ');
    if (t.type === 'LPAREN') { next(); const e = parseCond(); expect('RPAREN'); return e; }
    if (t.type === 'OVERLINE_OPEN') { next(); const e = parseCond(); expect('RBRACE'); return { type: 'COMPLEMENT', arg: e }; }
    if (t.type === 'ATOM') { next(); return { type: 'ATOM', name: t.name }; }
    if (t.type === 'EMPTY') { next(); return { type: 'EMPTY' }; }
    if (t.type === 'UNIVERSE') { next(); return { type: 'UNIVERSE' }; }
    return fail('không nhận diện được token ' + t.type);
  }
  function parseComplement() {
    let node = parsePrimary();
    while (peek() && peek().type === 'PRIME') { next(); node = { type: 'COMPLEMENT', arg: node }; }
    return node;
  }
  function parseInter() {
    let node = parseComplement();
    // Adjacency with no operator also means ∩. The tokenizer already puts an
    // explicit INTERSECT between letters in one unbroken run ("AB" -> A, ∩, B),
    // but a prime breaks that run ("BC'D": C' ends it, so D starts a fresh one
    // with nothing between them at the token level); without this the
    // implicit intersection would stop dead after the complemented letter and
    // leave D dangling.
    while (peek() && (peek().type === 'INTERSECT' || peek().type === 'DIFF' || startsPrimary(peek()))) {
      if (peek().type === 'INTERSECT' || peek().type === 'DIFF') {
        const op = next().type;
        const rhs = parseComplement();
        node = op === 'DIFF'
          ? { type: 'INTERSECT', args: [node, { type: 'COMPLEMENT', arg: rhs }] }
          : { type: 'INTERSECT', args: [node, rhs] };
      } else {
        node = { type: 'INTERSECT', args: [node, parseComplement()] };
      }
    }
    return node;
  }
  function parseUnion() {
    let node = parseInter();
    while (peek() && peek().type === 'UNION') { next(); node = { type: 'UNION', args: [node, parseInter()] }; }
    return node;
  }
  function parseCond() {
    let node = parseUnion();
    if (peek() && peek().type === 'PIPE') { next(); node = { type: 'COND', arg: node, given: parseUnion() }; }
    return node;
  }
  const node = parseCond();
  if (pos !== toks.length) fail('còn dư ký hiệu chưa xử lý hết');
  return node;
}

function parseExpression(str) { return parseTokens(tokenize(str), ''); }
function parseCondExprFromTokens(tokSlice) { return parseTokens(tokSlice, ' trong P(...)'); }

// Accepts "P(...)" or a bare set expression. Whatever follows the closing
// parenthesis of P(...) is an error, not something to quietly drop -- "P(A) U B"
// or "P(A)=0.6" would otherwise silently be answered as just P(A).
function parseQuery(str) {
  const toks = tokenize(str);
  if (!toks.length || toks[0].type !== 'PFUNC') {
    return { type: 'PROBWRAP', arg: parseExpression(str) };
  }
  if (toks[1] && toks[1].type === 'LPAREN') {
    let depth = 0, start = -1, end = -1;
    for (let k = 1; k < toks.length; k++) {
      if (toks[k].type === 'LPAREN') { if (depth === 0) start = k; depth++; }
      else if (toks[k].type === 'RPAREN') { depth--; if (depth === 0) { end = k; break; } }
    }
    if (start === -1 || end === -1) throw new Error('Lỗi cú pháp: thiếu dấu ngoặc trong P(...)');
    if (end !== toks.length - 1) throw new Error('Lỗi cú pháp: còn dư ký hiệu sau dấu ngoặc đóng của P(...)');
    return { type: 'PROBWRAP', arg: parseCondExprFromTokens(toks.slice(start + 1, end)) };
  }
  throw new Error('Lỗi cú pháp: cần dạng P(...)');
}
