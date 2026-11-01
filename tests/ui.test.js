const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
let JSDOM, VirtualConsole, createCanvas;
try { ({ JSDOM, VirtualConsole } = require('jsdom')); ({ createCanvas } = require('canvas')); } catch (e) { JSDOM = null; }
const skip = JSDOM ? false : 'packages "jsdom" and "canvas" not installed (run npm install)';

const ROOT = path.join(__dirname, '..');
const wait = ms => new Promise(r => setTimeout(r, ms));

// Loads the real index.html (scripts from disk); only the two CDN libraries
// are replaced by tiny stand-ins so the tests need no network.
async function boot() {
  const target = process.env.UI_TARGET || 'index.html';   // UI_TARGET=dist/cong-cu-xac-suat-tap-hop.html tests the built file
  let html = fs.readFileSync(path.join(ROOT, target), 'utf-8');
  html = html
    .replace(/<link[^>]*cdnjs[^>]*>/g, '')
    .replace(/<script (?:defer )?src="https:\/\/cdnjs[^"]*katex[^"]*"><\/script>/, `<script>window.katex={render:function(l,el){el.setAttribute('data-katex-src',l);el.textContent='K';}};</script>`)
    .replace(/<script (?:defer )?src="https:\/\/cdnjs[^"]*html2canvas[^"]*"><\/script>/, `<script>window.html2canvas=function(){return Promise.resolve({toDataURL:function(){return 'data:image/png;base64,';}});};</script>`);
  const vc = new VirtualConsole();
  const errors = [];
  vc.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', url: pathToUrl(path.join(ROOT, 'index.html')), virtualConsole: vc, pretendToBeVisual: true });
  const { window } = dom;
  for (let i = 0; i < 60 && !(window.runSolve && window.document.querySelector('#hypothesesList .hyp-row')); i++) await wait(50);
  const doc = window.document;
  return { dom, window, doc, errors, $: id => doc.getElementById(id) };
}
function pathToUrl(p) { return 'file://' + p.split(path.sep).join('/'); }
const clickAdd = ($, expr, val) => { $('hypExpr').value = expr; $('hypValue').value = val; $('addHypBtn').click(); };
const answerSrc = $ => { const el = $('resultsBody').querySelector('.result-answer'); return el ? el.getAttribute('data-katex-src') : null; };

test('boots with the default example, ARIA tabs, an empty results state and no script errors', { skip }, async () => {
  const { $, doc, errors } = await boot();
  assert.deepEqual(errors, []);
  assert.equal(doc.querySelectorAll('#hypothesesList .hyp-row').length, 7);
  assert.equal($('hypCount').textContent, '(7)');
  assert.ok($('emptyState'));
  const tabs = [...doc.querySelectorAll('[role="tab"]')];
  assert.deepEqual(tabs.map(t => t.getAttribute('aria-selected')), ['true', 'false', 'false']);
  assert.equal($('pane-latex').hidden, true);
});

test('solving the default 3-set example gives 0.8 with steps, a Venn diagram and a spoken summary', { skip }, async () => {
  const { $, doc, window } = await boot();
  $('solveBtn').click();
  assert.match(answerSrc($), /= 0\.8 = \\dfrac\{4\}\{5\}/);
  assert.ok(doc.querySelectorAll('.steps .step').length >= 2);
  assert.ok($('vennSvgContainer').querySelector('svg'));
  assert.match($('liveStatus').textContent, /Đã giải xong/);
  assert.ok(doc.querySelector('.venn-data table'), 'region table is available alongside the diagram');
  window.close();
});

test('example menu: inverse inference (P(A∩B) from P(A), P(B), P(A∪B)) is solved and explained', { skip }, async () => {
  const { $, doc } = await boot();
  $('exampleSelect').value = 'inverse';
  $('exampleSelect').dispatchEvent(new doc.defaultView.Event('change'));
  assert.match(answerSrc($), /= 0\.3 = \\dfrac\{3\}\{10\}/);
  assert.match($('resultsBody').querySelector('.step-eq').getAttribute('data-katex-src'), /0\.5 \+ 0\.6 - 0\.8 = 0\.3/);
  assert.match($('resultsBody').querySelector('.result-aux').textContent, /suy ngược/);
});

test('every example solves to a number without warnings', { skip }, async () => {
  const { $, doc } = await boot();
  const expected = { pie2: 0.7, pie3: 0.8, indep: 0.7, mutex: 0.5, cond: 0.4, inverse: 0.3, bayes: 0.03 / 0.14, four: 0.88 };
  for (const [id, want] of Object.entries(expected)) {
    $('exampleSelect').value = id;
    $('exampleSelect').dispatchEvent(new doc.defaultView.Event('change'));
    const m = answerSrc($).match(/= (-?[\d.]+)/);
    assert.ok(m && Math.abs(parseFloat(m[1]) - want) < 1e-5, `${id}: ${answerSrc($)}`);
    assert.equal($('resultsBody').querySelector('.banner'), null, id + ' should not warn');
  }
});

test('value validation: range, fractions, update-in-place, garbage', { skip }, async () => {
  const { $, doc } = await boot();
  $('clearHypBtn').click();
  const rows = () => doc.querySelectorAll('#hypothesesList .hyp-row').length;
  const err = () => ($('hypError').hidden ? '' : $('hypError').textContent);

  clickAdd($, 'A', '3/8'); assert.equal(rows(), 1); assert.equal(err(), '');
  clickAdd($, 'B', '3 / 8'); assert.equal(rows(), 2);
  clickAdd($, 'C', '0'); clickAdd($, 'D', '1'); assert.equal(rows(), 4);
  clickAdd($, 'E', '1.5'); assert.match(err(), /\[0, 1\]/); assert.equal(rows(), 4);
  clickAdd($, 'E', '-0.2'); assert.match(err(), /\[0, 1\]/);
  clickAdd($, 'E', '5/3'); assert.match(err(), /\[0, 1\]/);
  clickAdd($, 'E', '1/0'); assert.match(err(), /phân số/);
  clickAdd($, 'E', 'abc'); assert.match(err(), /phân số/);
  clickAdd($, 'E', ''); assert.match(err(), /cả biểu thức và giá trị/);
  clickAdd($, 'A', '0.5'); assert.equal(rows(), 4, 'same expression updates instead of duplicating');
  assert.match(doc.querySelector('#hypothesesList .hyp-eq').getAttribute('data-katex-src'), /0\.5$/);
  // "P(A)=0.6" typed whole into the expression box is split automatically
  $('hypExpr').value = 'P(F)=0.6'; $('hypValue').value = ''; $('addHypBtn').click();
  assert.equal(rows(), 5); assert.equal(err(), '');
});

test('contradictory facts are refused with a reason; consistent ones are accepted', { skip }, async () => {
  const { $, doc } = await boot();
  $('clearHypBtn').click();
  const rows = () => doc.querySelectorAll('#hypothesesList .hyp-row').length;
  const err = () => ($('hypError').hidden ? '' : $('hypError').textContent);
  clickAdd($, 'A', '0.2'); assert.equal(rows(), 1);
  clickAdd($, 'A n B', '0.4'); assert.equal(rows(), 1, 'P(A∩B) > P(A) must be refused');
  assert.match(err(), /mâu thuẫn/); assert.match(err(), /âm/);
  clickAdd($, 'A n B', '0.1'); assert.equal(rows(), 2); assert.equal(err(), '');
  clickAdd($, 'A U B', '0.1'); assert.equal(rows(), 2, 'P(A∪B) < P(A) must be refused');
  clickAdd($, 'B', '0.3'); clickAdd($, 'A U B', '0.9');
  assert.equal(rows(), 3, 'inconsistent inclusion-exclusion data must be refused');
});

test('removals can be undone from the toast; clearing everything too', { skip }, async () => {
  const { $, doc } = await boot();
  const rows = () => doc.querySelectorAll('#hypothesesList .hyp-row').length;
  doc.querySelector('#hypothesesList .hyp-remove').click();
  assert.equal(rows(), 6);
  const undo = doc.querySelector('#toastRegion .toast-action');
  assert.equal(undo.textContent, 'Hoàn tác');
  undo.click();
  assert.equal(rows(), 7);
  $('clearHypBtn').click(); assert.equal(rows(), 0);
  doc.querySelector('#toastRegion .toast:last-child .toast-action').click();
  assert.equal(rows(), 7);
});

test('dialog: buttons with aria-pressed, max selection, Escape closes and focus returns', { skip }, async () => {
  const { $, doc, window } = await boot();
  const KeyboardEvent = window.KeyboardEvent;
  $('addMutexBtn').focus();
  $('addMutexBtn').click();
  assert.equal($('modalBackdrop').hidden, false);
  assert.equal($('modalContent').getAttribute('role'), 'dialog');
  const chips = [...doc.querySelectorAll('#modalContent .chip-option')];
  assert.ok(chips.length >= 3 && chips.every(c => c.tagName === 'BUTTON' && c.getAttribute('aria-pressed') === 'false'));
  const confirm = [...doc.querySelectorAll('#modalContent button')].find(b => /Xác nhận/.test(b.textContent));
  assert.equal(confirm.disabled, true);
  chips[0].click(); chips[1].click();
  assert.equal(chips[0].getAttribute('aria-pressed'), 'true');
  assert.equal(chips[2].disabled, true, 'mutex allows at most 2');
  assert.equal(confirm.disabled, false);
  $('modalBackdrop').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal($('modalBackdrop').hidden, true);
  assert.equal(doc.activeElement, $('addMutexBtn'));
});

test('dialog: declaring independence / mutex / partition updates the list; contradictions are refused inside the dialog', { skip }, async () => {
  const { $, doc } = await boot();
  $('clearHypBtn').click();
  clickAdd($, 'A', '0.4'); clickAdd($, 'B', '0.3');
  $('addMutexBtn').click();
  let chips = [...doc.querySelectorAll('#modalContent .chip-option')];
  chips.filter(c => ['A', 'B'].includes(c.dataset.name)).forEach(c => c.click());
  [...doc.querySelectorAll('#modalContent button')].find(b => /Xác nhận/.test(b.textContent)).click();
  assert.equal($('modalBackdrop').hidden, true);
  assert.ok([...doc.querySelectorAll('#hypothesesList .hyp-eq')].some(e => /Xung khắc/.test(e.textContent)));
  // independent AND mutually exclusive with positive probabilities is impossible
  $('addIndepBtn').click();
  chips = [...doc.querySelectorAll('#modalContent .chip-option')];
  chips.filter(c => ['A', 'B'].includes(c.dataset.name)).forEach(c => c.click());
  [...doc.querySelectorAll('#modalContent button')].find(b => /Xác nhận/.test(b.textContent)).click();
  assert.equal($('modalBackdrop').hidden, false, 'dialog stays open on error');
  assert.match(doc.querySelector('#modalContent .field-error').textContent, /mâu thuẫn/);
});

test('ARIA tabs: arrow keys move selection and toggle panels', { skip }, async () => {
  const { $, doc, window } = await boot();
  const tab = $('tab-text');
  tab.focus();
  doc.querySelector('.tabs').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert.equal($('tab-latex').getAttribute('aria-selected'), 'true');
  assert.equal($('pane-latex').hidden, false);
  assert.equal($('pane-text').hidden, true);
  assert.equal(doc.activeElement, $('tab-latex'));
  $('solveBtn').click();
  assert.match(answerSrc($), /= 0\.45/, 'LaTeX tab solves its own input: P(A ∪ (B ∩ C)) = 0.3 + 0.2 - 0.05');
});

test('accessibility basics: names for every control, live regions, no Georgia', { skip }, async () => {
  const { $, doc } = await boot();
  doc.querySelector('#hypothesesList .hyp-remove'); // rendered
  for (const b of doc.querySelectorAll('button')) {
    assert.ok((b.textContent || '').trim() || b.getAttribute('aria-label'), 'unnamed button: ' + b.outerHTML);
  }
  for (const el of doc.querySelectorAll('input[type="text"], textarea, select')) {
    const labelled = el.getAttribute('aria-label') || (el.id && doc.querySelector(`label[for="${el.id}"]`));
    assert.ok(labelled, 'unlabelled field: ' + el.id);
  }
  assert.equal($('hypError').getAttribute('role'), 'alert');
  assert.equal($('imgStatus').getAttribute('aria-live'), 'polite');
  assert.equal($('liveStatus').getAttribute('role'), 'status');
  assert.ok(doc.querySelector('.skip-link'));
  assert.equal(doc.documentElement.lang, 'vi');
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, ''), /Georgia/);
  for (const f of fs.readdirSync(path.join(ROOT, 'js'))) {
    assert.doesNotMatch(fs.readFileSync(path.join(ROOT, 'js', f), 'utf-8'), /Georgia/, f);
  }
});

test('state survives a save/restore round trip (facts, declarations, inputs)', { skip }, async () => {
  const { window } = await boot();
  window.eval(`
    state.independentGroups.push({ names: ['A', 'B'] });
    state.mutexPairs.push(['B', 'C']);
    state.partition = ['A', 'C'];
    document.getElementById('exprInput').value = 'P(A n B)';
  `);
  const snap = JSON.parse(JSON.stringify(window.eval('serializeState()')));
  window.eval('state.hypotheses = []; state.independentGroups = []; state.mutexPairs = []; state.partition = null;');
  window.applySnapshot(snap);
  assert.equal(window.eval('state.hypotheses.length'), 7);
  assert.deepEqual(window.eval('state.independentGroups.map(g => g.names)'), [['A', 'B']]);
  assert.deepEqual(window.eval('state.partition'), ['A', 'C']);
  assert.equal(window.eval("document.getElementById('exprInput').value"), 'P(A n B)');
});

// ------------------------------------------------------------- images
function drawLines(lines, font, lh) {
  const c = createCanvas(520, lines.length * lh + 40);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#000'; ctx.font = font; ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => ctx.fillText(l, 15, 42 + i * lh));
  return c;
}
async function feedImage(env, canvas, name) {
  const file = new env.window.File([canvas.toBuffer('image/png')], name || 'x.png', { type: 'image/png' });
  env.window.handleImageFile(file);
  for (let i = 0; i < 100; i++) {
    await wait(100);
    if (env.doc.querySelector('#imgReviewArea .review-row') || /Đã nhận diện: /.test(env.$('imgStatus').textContent)) break;
  }
}

test('image of several hypotheses (math-style italic): review rows are editable, show thumbnails, and feed the solver', { skip, timeout: 60000 }, async () => {
  const env = await boot();
  const { $, doc } = env;
  $('clearHypBtn').click();
  await feedImage(env, drawLines(['P(A) = 0.8', 'P(B) = 0.3', 'P(AB) = 0.2'], 'italic 34px serif', 55));
  const rows = [...doc.querySelectorAll('#imgReviewArea .review-row')];
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(r => r.querySelector('.line-text').value), ['P(A)=0.8', 'P(B)=0.3', 'P(AB)=0.2']);
  assert.ok(rows.every(r => /^data:image\/png/.test(r.querySelector('.review-thumb').getAttribute('src'))));
  assert.ok(rows.every(r => !r.querySelector('.line-tag').hidden), 'all three read as hypotheses');

  // a misread can be fixed in place: break line 2, then repair it by typing
  const input = rows[1].querySelector('.line-text');
  input.value = 'P(B)=0.D'; input.dispatchEvent(new env.window.Event('input', { bubbles: true }));
  assert.equal(rows[1].querySelector('.line-tag').hidden, true);
  input.value = 'P(B)=0.3'; input.dispatchEvent(new env.window.Event('input', { bubbles: true }));
  assert.equal(rows[1].querySelector('.line-tag').hidden, false);

  const all = [...doc.querySelectorAll('#imgReviewArea button')].find(b => /Thêm tất cả 3/.test(b.textContent));
  assert.ok(all);
  all.click();
  assert.equal(doc.querySelectorAll('#hypothesesList .hyp-row').length, 3);
  $('exprInput').value = 'P(B|A)'; $('solveBtn').click();
  assert.match(answerSrc($), /= 0\.25/);
});

test('image with a bar over a letter becomes a complement in the expression box', { skip, timeout: 60000 }, async () => {
  const env = await boot();
  const c = createCanvas(420, 90); const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 420, 90); ctx.fillStyle = '#000'; ctx.font = '36px sans-serif';
  let x = 20; const boxes = [];
  for (const ch of 'ABCD') { const w = ctx.measureText(ch).width; ctx.fillText(ch, x, 62); boxes.push({ x, w }); x += w; }
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(boxes[2].x + 3, 26); ctx.lineTo(boxes[2].x + boxes[2].w - 3, 26); ctx.stroke();
  await feedImage(env, c, 'bar.png');
  assert.equal(env.$('exprInput').value, "ABC'D");
  assert.match(env.$('imgStatus').textContent, /ABC'D/);
});

test('a file that is not an image is rejected politely', { skip }, async () => {
  const env = await boot();
  env.window.handleImageFile(new env.window.File(['hello'], 'x.txt', { type: 'text/plain' }));
  assert.match(env.$('imgStatus').textContent, /không phải ảnh/);
});
