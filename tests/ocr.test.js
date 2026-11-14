const test = require('node:test');
const assert = require('node:assert/strict');
let createCanvas;
try { ({ createCanvas } = require('canvas')); } catch (e) { createCanvas = null; }
const { loadModules } = require('./helpers/load');

// OCR tests need the `canvas` package (npm install); skip cleanly without it.
const skip = createCanvas ? false : 'package "canvas" not installed (run npm install)';
const M = loadModules();
const { renderTemplates, recognizeMultiLine, recognizeLinesDetailed, recognizeCanvas, parseQuery, flatten, canonicalKey } = M;
const templates = skip ? null : renderTemplates(createCanvas);

function renderLines(lines, font, lh, bg, fg) {
  bg = bg || '#fff'; fg = fg || '#000';
  const c = createCanvas(650, lines.length * lh + 50);
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = fg; ctx.font = font; ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => ctx.fillText(l, 15, 45 + i * lh));
  return c;
}
function renderWithOverline(text, barredIndices, font, barPad) {
  const c = createCanvas(700, 110);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 700, 110);
  ctx.fillStyle = '#000'; ctx.font = font; ctx.textBaseline = 'alphabetic';
  let x = 20; const boxes = [];
  for (const ch of text) {
    const w = ctx.measureText(ch).width;
    if (ch !== ' ') ctx.fillText(ch, x, 65);
    boxes.push({ x, w }); x += w;
  }
  ctx.lineWidth = 2;
  for (const idx of barredIndices) {
    const b = boxes[idx]; const pad = barPad == null ? b.w * 0.08 : barPad;
    ctx.beginPath(); ctx.moveTo(b.x + pad, 30); ctx.lineTo(b.x + b.w - pad, 30); ctx.stroke();
  }
  return c;
}
const rec = canvas => recognizeMultiLine(canvas, templates, createCanvas);

const HYP = ['P(A)=0.8', 'P(B)=0.3', 'P(AB)=0.2'];

test('math-style (italic) and upright multi-line hypotheses', { skip }, () => {
  assert.deepEqual(rec(renderLines(HYP, 'italic 36px serif', 60)), HYP);
  assert.deepEqual(rec(renderLines(HYP, 'italic 36px sans-serif', 60)), HYP);
  assert.deepEqual(rec(renderLines(HYP, '36px serif', 60)), HYP);
  assert.deepEqual(rec(renderLines(HYP, '36px sans-serif', 60)), HYP);
  assert.deepEqual(rec(renderLines(HYP, 'italic 30px serif', 52)), HYP);
});

test('light text on a dark background', { skip }, () => {
  assert.deepEqual(rec(renderLines(['P(A)=0.6', 'P(B)=0.5', 'P(A|B)=0.8'], '36px sans-serif', 55, '#1B2321', '#EDEDE6')),
    ['P(A)=0.6', 'P(B)=0.5', 'P(A|B)=0.8']);
});

test('"=" is not confused with "|", and a single expression line reads whole', { skip }, () => {
  assert.deepEqual(rec(renderLines(['P(A)=0.6', 'P(A|B)=0.8'], '36px "Liberation Serif"', 55)), ['P(A)=0.6', 'P(A|B)=0.8']);
  assert.equal(recognizeCanvas(renderLines(['P(A U (B n C))'], '40px Arial', 60), templates, createCanvas), 'P(AU(BnC))');
});

test('overlines become complements: upright, italic, wide bars, inside P(...)', { skip }, () => {
  const want = ["ABC'DUABC'DUABC'DUABC'D"];
  assert.deepEqual(rec(renderWithOverline('ABCD U ABCD U ABCD U ABCD', [2, 9, 16, 23], '30px sans-serif')), want);
  assert.deepEqual(rec(renderWithOverline('ABCD U ABCD U ABCD U ABCD', [2, 9, 16, 23], 'italic 32px serif')), want);
  assert.deepEqual(rec(renderWithOverline('ABCD', [2], '36px sans-serif', -4)), ["ABC'D"]);
  assert.deepEqual(rec(renderWithOverline('P(ABCD)', [4], '36px sans-serif')), ["P(ABC'D)"]);
});

test('what follows the last "=" is decoded as a number even at tiny sizes', { skip }, () => {
  const out = rec(renderLines(['P(A)=0.5', 'P(B)=0.05', 'P(C)=0.2'], '18px "Liberation Serif"', 30));
  for (const line of out) assert.match(line.split('=').pop(), /^[0-9.]*$/, line);
});

test('detailed API returns ordered, non-overlapping pixel bands', { skip }, () => {
  const d = recognizeLinesDetailed(renderLines(HYP, '36px serif', 60), templates, createCanvas);
  assert.equal(d.length, 3);
  d.forEach((l, i) => { assert.ok(l.bottom > l.top); if (i) assert.ok(l.top > d[i - 1].bottom); });
});

test('recognized overline text is valid input for the parser', { skip }, () => {
  const out = rec(renderWithOverline('ABCD U ABCD U ABCD U ABCD', [2, 9, 16, 23], 'italic 32px serif'))[0];
  assert.doesNotThrow(() => canonicalKey(flatten(parseQuery('P(' + out + ')').arg)));
});

test('real union / intersection symbols (as typeset by Word or LaTeX) read as U / n', { skip }, () => {
  const lines = ['P(A \u222A B)', 'P(A \u2229 B)', 'P(A \u222A (B \u2229 C))', 'P(ABCD \u222A ABCD)'];
  const want = ['P(AUB)', 'P(AnB)', 'P(AU(BnC))', 'P(ABCDUABCD)'];
  for (const font of ['italic 34px serif', '34px serif', 'italic 34px sans-serif', '34px sans-serif']) {
    assert.deepEqual(rec(renderLines(lines, font, 55)), want, font);
  }
});

test('the reported equation: four unions of ABCD, a bar over D, A, B, C respectively, all inside P( )', { skip }, () => {
  const text = 'P(ABCD \u222A ABCD \u222A ABCD \u222A ABCD)';
  const barred = [5, 9, 17, 25];
  for (const [font, barY] of [['italic 32px serif', 33], ['italic 36px serif', 30], ['32px serif', 33], ['italic 30px sans-serif', 36], ['italic 28px serif', 38]]) {
    const c = createCanvas(800, 110); const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 800, 110); ctx.fillStyle = '#000'; ctx.font = font;
    let x = 20; const boxes = [];
    for (const ch of text) { const w = ctx.measureText(ch).width; if (ch !== ' ') ctx.fillText(ch, x, 70); boxes.push({ x, w }); x += w; }
    ctx.lineWidth = 2;
    for (const i of barred) { const b = boxes[i]; ctx.beginPath(); ctx.moveTo(b.x + 1, barY); ctx.lineTo(b.x + b.w - 1, barY); ctx.stroke(); }
    assert.deepEqual(rec(c), ["P(ABCD'UA'BCDUAB'CDUABC'D)"], font);
  }
});

// Real screenshots from the person who reported the misreads (fonts a Linux
// sandbox cannot synthesize: Calibri, Times New Roman, Cambria-style math
// italic). The page upscales small crops before recognizing them; so does this.
const fs = require('fs');
const path = require('path');
const { loadImage } = (() => { try { return require('canvas'); } catch (e) { return {}; } })();
async function recognizeFixture(name) {
  const img = await loadImage(path.join(__dirname, 'fixtures', name));
  const scale = img.width > 1000 ? 1000 / img.width : (img.width < 400 ? Math.min(2, 640 / img.width) : 1);
  const c = createCanvas(Math.round(img.width * scale), Math.round(img.height * scale));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return rec(c);
}
test('real screenshot, Calibri: thin tall parentheses are not mistaken for "|"', { skip }, async () => {
  assert.deepEqual(await recognizeFixture('calibri-3-lines.png'), ['P(A)=0.8', 'P(B)=0.3', 'P(AB)=0.2']);
});
test('real screenshot, Times New Roman: hairline strokes of 2 and 3 stay in one piece', { skip }, async () => {
  assert.deepEqual(await recognizeFixture('times-3-lines.png'), ['P(A)=0.8', 'P(B)=0.3', 'P(AB)=0.2']);
});
test('real screenshot, math italic with overlines: bars on D, A, B, C and B is not read as 8', { skip }, async () => {
  assert.deepEqual(await recognizeFixture('cambria-italic-overlines.png'), ["P(ABCD'UA'BCDUAB'CDUABC'D)"]);
});

// ---- stacked fractions ----------------------------------------------------
const { typeset } = require('./helpers/typeset');
const FRACTION_LINES = [
  [[{ t: 'text', s: 'P(A|B' }, { t: 'sub', s: '1' }, { t: 'text', s: ') = 0.6' }], 'P(A|B1)=0.6'],
  [[{ t: 'text', s: 'P(A|B' }, { t: 'sub', s: '2' }, { t: 'text', s: ') = ' }, { t: 'frac', n: '2', d: '3' }], 'P(A|B2)=2/3'],
  [[{ t: 'text', s: 'P(' }, { t: 'over', s: 'A' }, { t: 'text', s: '|B' }, { t: 'sub', s: '3' }, { t: 'text', s: ') = ' }, { t: 'frac', n: '1', d: '6' }], "P(A'|B3)=1/6"],
  [[{ t: 'text', s: 'P(B' }, { t: 'sub', s: '1' }, { t: 'text', s: ') = ' }, { t: 'frac', n: '3', d: '4' }], 'P(B1)=3/4'],
  [[{ t: 'text', s: 'P(B' }, { t: 'sub', s: '2' }, { t: 'text', s: ') = ' }, { t: 'frac', n: '1', d: '10' }], 'P(B2)=1/10'],
];
test('stacked fractions with subscripts and a barred letter, italic and upright, three sizes', { skip }, () => {
  for (const style of ['italic ', '']) for (const size of [26, 34, 42]) {
    const lh = Math.round(size * 2.3);
    const c = createCanvas(420, FRACTION_LINES.length * lh + 30);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.fillStyle = '#000';
    FRACTION_LINES.forEach(([toks], i) => typeset(ctx, toks, 14, Math.round(size * 1.5) + i * lh, size, style));
    assert.deepEqual(rec(c), FRACTION_LINES.map(l => l[1]), `${style}${size}px`);
  }
});
test('real screenshot with stacked fractions and a bar over B: 2/3 and 3/4 are read as fractions', { skip }, async () => {
  assert.deepEqual(await recognizeFixture('fractions-3-lines.png'), ['P(A|B)=0.6', "P(A|B')=2/3", 'P(B)=3/4']);
});
test('a recognized fraction line is a usable hypothesis', { skip }, () => {
  const { tryLineAsHypothesis } = M;
  const h = tryLineAsHypothesis("P(A|B')=2/3");
  assert.equal(h.exprPart, "P(A|B')");
  assert.ok(Math.abs(h.value - 2 / 3) < 1e-12);
});
