/* ============================================================
   EXPORT: LaTeX that compiles outside the browser

   The page draws formulas with KaTeX, which understands {\color{#7EB6D9}{A}}.
   Real LaTeX does not: "#" is the macro-parameter character and \color wants
   [HTML]{7EB6D9}. So the strings built for the screen need translating
   before they can leave it:
     - for pasting into a document of one's own: colours dropped entirely;
     - for the downloadable .tex: colours kept, as \textcolor[HTML]{...}{...}
       (xcolor), inside a complete document.
   ============================================================ */

const TEX_COLOR_GROUP = /\{\\color\{#([0-9A-Fa-f]{6})\}\{([^{}]*)\}\}/g;

function stripLatexColor(tex) { return tex.replace(TEX_COLOR_GROUP, '$2'); }
function colorToXcolor(tex) { return tex.replace(TEX_COLOR_GROUP, (_, hex, body) => `\\textcolor[HTML]{${hex.toUpperCase()}}{${body}}`); }

// Plain-text strings (rule names, notes) into LaTeX text mode.
function texText(s) {
  const symbols = { '∪': '$\\cup$', '∩': '$\\cap$', 'Ω': '$\\Omega$', '∅': '$\\emptyset$', '·': '$\\cdot$', '≈': '$\\approx$', '−': '$-$', 'Ē': '$\\overline{E}$', '|': '$\\mid$', '<': '$<$', '>': '$>$' };
  let out = '';
  for (const ch of String(s)) {
    if (symbols[ch]) out += symbols[ch];
    else if ('&%$#_{}'.includes(ch)) out += '\\' + ch;
    else if (ch === '\\') out += '\\textbackslash{}';
    else if (ch === '~') out += '\\textasciitilde{}';
    else if (ch === '^') out += '\\textasciicircum{}';
    else out += ch;
  }
  return out;
}

function finalLineLatex(queryLatex, finalResult) {
  if (finalResult.numeric == null) return `${queryLatex} = ${finalResult.latex}`;
  const fr = bestFraction(finalResult.numeric);
  const tail = fr && fr.q > 1 ? (fr.exact ? ' = ' : ' \\approx ') + `\\dfrac{${fr.p}}{${fr.q}}` : '';
  return `${queryLatex} = ${fmtNum(finalResult.numeric)}${tail}`;
}

// Just the equations, for pasting into an existing document (needs amsmath)
function buildLatexSnippet(steps, queryLatex, finalResult) {
  const finalLine = finalLineLatex(queryLatex, finalResult);
  const body = steps.length
    ? '\\begin{gathered}\n' + steps.map(s => s.eq).join(' \\\\\n') + ' \\\\\n' + finalLine + '\n\\end{gathered}'
    : finalLine;
  return stripLatexColor(body);
}

// A complete document; compiles with pdfLaTeX (e.g. Overleaf's default)
function buildLatexDocument(steps, queryLatex, finalResult, givens) {
  const lines = [];
  const push = (...a) => lines.push(...a);
  push('% Lời giải được tạo bởi "Công cụ giải Xác suất & Tập hợp".',
    '% Biên dịch bằng pdfLaTeX (mặc định của Overleaf). Dòng [T5]{fontenc} và lmodern để gõ được tiếng Việt.',
    '\\documentclass[12pt]{article}',
    '\\usepackage[utf8]{inputenc}',
    '\\usepackage[T5]{fontenc}',
    '\\usepackage{lmodern}',
    '\\usepackage{amsmath, amssymb}',
    '\\usepackage{xcolor}',
    '\\usepackage[margin=2.2cm]{geometry}',
    '\\setlength{\\parindent}{0pt}',
    '\\allowdisplaybreaks',
    '\\begin{document}',
    '',
    '\\section*{Lời giải}',
    '',
    `\\textbf{Cần tính:} $${queryLatex}$`,
    '');
  if (givens && givens.length) {
    push('\\textbf{Giả thiết:}', '\\begin{itemize}');
    givens.forEach(g => push(g.text != null ? `  \\item ${texText(g.text)}` : `  \\item $${g.latex}$`));
    push('\\end{itemize}', '');
  }
  if (steps.length) {
    push('\\textbf{Các bước giải:}', '\\begin{enumerate}');
    for (const s of steps) {
      push(`  \\item \\textbf{${texText(s.rule)}}`, '  \\[', `    ${s.eq}`, '  \\]');
      if (s.note) push(`  ${texText(s.note)}`);
    }
    push('\\end{enumerate}', '');
  }
  push('\\textbf{Kết quả:}', '\\[', `  ${finalLineLatex(queryLatex, finalResult)}`, '\\]', '', '\\end{document}', '');
  return colorToXcolor(lines.join('\n'));
}

// ---- shareable link ---------------------------------------------------------
// The whole problem fits in a short URL fragment: JSON -> UTF-8 -> base64url.
// The fragment is never sent to a server, so sharing stays private, and a
// static page (GitHub Pages) needs no backend to open it.
function encodeShareState(obj) {
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeShareState(text) {
  try {
    let b64 = String(text).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const obj = JSON.parse(decodeURIComponent(escape(atob(b64))));
    return obj && obj.v === 2 ? obj : null;
  } catch (e) { return null; }
}
