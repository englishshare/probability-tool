const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadModules } = require('./helpers/load');
const M = loadModules();
const { parseQuery, flatten, canonicalKey, solveQuery, toProbLatex, stripLatexColor, colorToXcolor, texText,
  buildLatexSnippet, buildLatexDocument, hypothesisLatex } = M;

const palette = { A: '#7EB6D9', B: '#E38C7A', C: '#79C9A4', D: '#C9A6E0', B1: '#79C9A4', B2: '#C9A6E0', B3: '#E0B979' };
const colorOf = n => palette[n] || '#8FA9D9';
const k = s => canonicalKey(flatten(parseQuery(s).arg));
const q = s => flatten(parseQuery(s).arg);
const ctxOf = (pairs, extra) => Object.assign({ knownProb: new Map(pairs), independentGroups: [], mutexPairs: new Set(), partition: null }, extra || {});

function solved(query, ctx) {
  const out = solveQuery(q(query), ctx, colorOf);
  return { steps: out.steps, queryLatex: toProbLatex(q(query), colorOf), finalResult: { numeric: out.numeric, latex: out.latex } };
}

const SAMPLES = {
  'inclusion-exclusion (3 sets)': ['P(A U B U C)', ctxOf([[k('A'), .3], [k('B'), .4], [k('C'), .5], [k('A n B'), .1], [k('A n C'), .15], [k('B n C'), .2], [k('A n B n C'), .05]])],
  'total probability over {B, B̄}': ['P(A)', ctxOf([['A|B', .6], ['A|~B', 2 / 3], [k('B'), .75]])],
  'Bayes over a declared partition': ['P(B1|A)', ctxOf([['A|B1', .6], ['A|B2', 2 / 3], ['~A|B3', 1 / 6], [k('B1'), .75], [k('B2'), .1]], { partition: ['B1', 'B2', 'B3'] })],
  'inverse via the linear model': ['P(A n B)', ctxOf([[k('A'), .5], [k('B'), .6], [k('A U B'), .8]])],
  'complement with a colour': ["P(A')", ctxOf([[k('A'), .3]])],
};

test('colour handling: KaTeX groups become plain text or xcolor, never a bare #', () => {
  const kat = '{\\color{#7EB6D9}{A}} \\cup {\\color{#E38C7A}{B1}}';
  assert.equal(stripLatexColor(kat), 'A \\cup B1');
  assert.equal(colorToXcolor(kat), '\\textcolor[HTML]{7EB6D9}{A} \\cup \\textcolor[HTML]{E38C7A}{B1}');
  assert.ok(!stripLatexColor(kat).includes('#'));
});

test('texText escapes what LaTeX treats specially and maps set symbols to math', () => {
  assert.equal(texText('P(A ∩ B) = 0.6 · P(B)'), 'P(A $\\cap$ B) = 0.6 $\\cdot$ P(B)');
  assert.equal(texText('100% & {E, Ē} #1 a_b'), '100\\% \\& \\{E, $\\overline{E}$\\} \\#1 a\\_b');
});

test('the pasteable snippet carries no colour commands and no "#"', () => {
  for (const [name, [query, ctx]] of Object.entries(SAMPLES)) {
    const { steps, queryLatex, finalResult } = solved(query, ctx);
    const snippet = buildLatexSnippet(steps, queryLatex, finalResult);
    assert.ok(!snippet.includes('\\color'), name);
    assert.ok(!snippet.includes('#'), name);
    assert.match(snippet, /\\end\{gathered\}$|= [\d.]+/, name);
  }
});

test('the document is complete, balanced, and keeps colours as xcolor', () => {
  const { steps, queryLatex, finalResult } = solved(...SAMPLES['total probability over {B, B̄}']);
  const doc = buildLatexDocument(steps, queryLatex, finalResult, [{ latex: 'P(A) = 0.5' }, { text: 'Độc lập: A, B' }]);
  for (const need of ['\\documentclass', '\\usepackage{amsmath, amssymb}', '\\usepackage{xcolor}', '\\begin{document}', '\\end{document}', '\\textcolor[HTML]{']) {
    assert.ok(doc.includes(need), need);
  }
  assert.ok(!doc.includes('\\color{'), 'no KaTeX-style colour group left');
  assert.ok(!/(^|[^\\])#/.test(doc), 'no unescaped #');
  const count = (re) => (doc.match(re) || []).length;
  assert.equal(count(/\\begin\{/g), count(/\\end\{/g));
  assert.equal(count(/\\left/g), count(/\\right/g));
});

// ---- the real test: does LaTeX accept it? ----------------------------------
const hasTex = spawnSync('pdflatex', ['--version']).status === 0;
const hasVietnamese = hasTex && spawnSync('kpsewhich', ['t5enc.def']).stdout.toString().trim() !== '';
for (const [name, [query, ctx]] of Object.entries(SAMPLES)) {
  test(`pdfLaTeX compiles the exported document: ${name}`, { skip: hasVietnamese ? false : 'pdflatex with Vietnamese (T5) support not installed' }, () => {
    const { steps, queryLatex, finalResult } = solved(query, ctx);
    const doc = buildLatexDocument(steps, queryLatex, finalResult, [{ latex: 'P(A) = 0.5' }, { text: 'Phân hoạch: B1, B2, B3' }]);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xs-tex-'));
    fs.writeFileSync(path.join(dir, 'loi-giai.tex'), doc);
    const r = spawnSync('pdflatex', ['-interaction=nonstopmode', '-halt-on-error', 'loi-giai.tex'], { cwd: dir, encoding: 'utf-8', timeout: 60000 });
    const log = (r.stdout || '') + (r.stderr || '');
    assert.equal(r.status, 0, 'pdflatex failed:\n' + log.split('\n').filter(l => /^!|l\.\d+/.test(l)).slice(0, 8).join('\n'));
    assert.ok(fs.existsSync(path.join(dir, 'loi-giai.pdf')));
  });
}

// ---- TikZ export of the Venn diagram ----------------------------------------
const { renderVennTikz, renderVennTikzDocument, computeMinterms } = M;
function regionsFor(names) {
  // a consistent full distribution: every region gets a distinct share
  const N = 1 << names.length, total = (N * (N + 1)) / 2;
  return { names, regions: Array.from({ length: N }, (_, mask) => ({ mask, numeric: (mask + 1) / total })) };
}
test('TikZ: structure for 1-4 sets, colours defined, braces balanced, nothing for 5+', () => {
  for (const n of [1, 2, 3, 4]) {
    const names = 'ABCD'.slice(0, n).split('');
    const { regions } = regionsFor(names);
    const tikz = renderVennTikz(names, regions, colorOf);
    assert.match(tikz, /^% .*\n\\begin\{tikzpicture\}/);
    assert.ok(tikz.endsWith('\\end{tikzpicture}'));
    assert.equal((tikz.match(/\\definecolor/g) || []).length, n);
    assert.equal((tikz.match(/\\filldraw/g) || []).length, n);
    assert.equal((tikz.match(/\{/g) || []).length, (tikz.match(/\}/g) || []).length);
    assert.ok(!tikz.includes('#'), 'no # in LaTeX');
    assert.equal((tikz.match(/\\node(?!\[text=)/g) || []).length, (1 << n), `${n} sets: one label per region (incl. outside)`);
  }
  assert.equal(renderVennTikz(['A', 'B', 'C', 'D', 'E'], [], colorOf), null);
});
for (const n of [1, 2, 3, 4]) {
  test(`pdfLaTeX compiles the TikZ Venn diagram (${n} set${n > 1 ? 's' : ''})`, { skip: hasTex && spawnSync('kpsewhich', ['standalone.cls']).stdout.toString().trim() ? false : 'pdflatex / standalone not installed' }, () => {
    const names = ['A', 'B1', 'C', 'D'].slice(0, n);
    const { regions } = regionsFor(names);
    regions[1].numeric = null;                // a "?" cell must compile too
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xs-tikz-'));
    fs.writeFileSync(path.join(dir, 'venn.tex'), renderVennTikzDocument(names, regions, colorOf));
    const r = spawnSync('pdflatex', ['-interaction=nonstopmode', '-halt-on-error', 'venn.tex'], { cwd: dir, encoding: 'utf-8', timeout: 90000 });
    assert.equal(r.status, 0, ((r.stdout || '') + (r.stderr || '')).split('\n').filter(l => /^!|l\.\d+/.test(l)).slice(0, 8).join('\n'));
  });
}

test('share links: any state round-trips through the URL fragment (Vietnamese text and symbols included)', () => {
  const { encodeShareState, decodeShareState } = M;
  const state = { v: 2, mode: 'text', expr: "P(A ∪ B')", latex: 'P(A \\cup B)', hyps: [{ t: "A ∩ B'", v: 0.125 }, { t: 'C | D', v: 2 / 3 }], indep: [['A', 'B']], mutex: [], partitions: [['B1', 'B2', 'B3']], note: 'Độc lập & xung khắc' };
  const enc = encodeShareState(state);
  assert.match(enc, /^[A-Za-z0-9_-]+$/, 'URL-safe, no padding');
  assert.deepEqual(decodeShareState(enc), state);
  assert.equal(decodeShareState('not-a-valid-state'), null);
  assert.equal(decodeShareState(encodeShareState({ v: 1 })), null, 'only the current format is accepted');
  assert.equal(decodeShareState(''), null);
});

test('the single-file build is a faithful bundle: valid JavaScript, every module included, no replacement-pattern corruption', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xs-build-'));
  const r = spawnSync('node', [path.join(__dirname, '..', 'scripts', 'build-single-file.js')], { encoding: 'utf-8' });
  assert.equal(r.status, 0, r.stderr);
  const html = fs.readFileSync(path.join(__dirname, '..', 'dist', 'cong-cu-xac-suat-tap-hop.html'), 'utf-8');
  const bundle = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).pop();
  assert.doesNotThrow(() => new Function(bundle), 'the inlined script must parse');
  const sources = fs.readdirSync(path.join(__dirname, '..', 'js')).map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf-8').trim());
  for (const src of sources) assert.ok(bundle.includes(src.replace(/<\/script/gi, '<\\/script')), 'a module was altered or dropped by the build');
});
