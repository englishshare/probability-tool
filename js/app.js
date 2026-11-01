/* ============================================================
   APP: UI controller -- state, rendering and event wiring.
   Depends on the other modules in js/ (loaded before this one).
   ============================================================ */

const $ = id => document.getElementById(id);
const STORAGE_KEY = 'xs-tap-hop:v2';

const state = {
  hypotheses: [],          // { node, value, key }
  independentGroups: [],   // { names: [...] }
  mutexPairs: [],          // [nameA, nameB]
  partition: null,         // [names...] | null
  colorMap: new Map(),
  colorPalette: ['#7EB6D9', '#E38C7A', '#79C9A4', '#C9A6E0', '#E0B979', '#8FA9D9'],
};

// ---------------------------------------------------------------- helpers
function colorOf(name) {
  if (!state.colorMap.has(name)) state.colorMap.set(name, state.colorPalette[state.colorMap.size % state.colorPalette.length]);
  return state.colorMap.get(name);
}

function renderKatexTo(el, latex, displayMode) {
  try { katex.render(latex, el, { displayMode: !!displayMode, throwOnError: false }); }
  catch (e) { el.textContent = latex; }
}

// tiny element builder: h('div', {class:'x', onclick: fn}, child, 'text', ...)
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid);
  return el;
}

const reducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

function hypothesisLatex(node, value) {
  if (node.type === 'COND') {
    return `P\\left(${toLatex(node.arg, colorOf)} \\mid ${toLatex(node.given, colorOf)}\\right) = ${fmtNum(value)}`;
  }
  return `${toProbLatex(node, colorOf)} = ${fmtNum(value)}`;
}

function plainFact(hyp) {
  return (hyp.node.type === 'COND'
    ? `P(${exprToText(hyp.node.arg)} | ${exprToText(hyp.node.given)})`
    : `P(${exprToText(hyp.node)})`) + ` = ${fmtNum(hyp.value)}`;
}

// ---------------------------------------------------------------- toasts
function showToast(message, opts) {
  opts = opts || {};
  const region = $('toastRegion');
  const el = h('div', { class: 'toast' + (opts.kind ? ' toast-' + opts.kind : '') }, h('span', { class: 'toast-text', text: message }));
  let timer = null;
  const dismiss = () => { clearTimeout(timer); el.remove(); };
  if (opts.action) {
    el.append(h('button', { type: 'button', class: 'toast-action', text: opts.action.label, onclick: () => { dismiss(); opts.action.onClick(); } }));
  }
  el.append(h('button', { type: 'button', class: 'toast-close', 'aria-label': 'Đóng thông báo', text: '×', onclick: dismiss }));
  region.append(el);
  while (region.children.length > 3) region.firstChild.remove();
  timer = setTimeout(dismiss, opts.timeout || 6500);
}

// ---------------------------------------------------------------- tabs
const tabEls = () => [...document.querySelectorAll('.tabs [role="tab"]')];
function getActiveMode() {
  const t = tabEls().find(el => el.getAttribute('aria-selected') === 'true');
  return t ? t.dataset.mode : 'text';
}
function activateTab(mode, moveFocus) {
  tabEls().forEach(t => {
    const on = t.dataset.mode === mode;
    t.setAttribute('aria-selected', on ? 'true' : 'false');
    t.tabIndex = on ? 0 : -1;
    $('pane-' + t.dataset.mode).hidden = !on;
    if (on && moveFocus) t.focus();
  });
  saveState();
}
function getActiveInputText() {
  return getActiveMode() === 'latex' ? $('latexInput').value : $('exprInput').value;
}

// ---------------------------------------------------------------- persistence
function serializeState() {
  return {
    v: 2,
    mode: getActiveMode(),
    expr: $('exprInput').value,
    latex: $('latexInput').value,
    hyps: state.hypotheses.map(x => ({ t: exprToText(x.node), v: x.value })),
    indep: state.independentGroups.map(g => g.names),
    mutex: state.mutexPairs,
    partition: state.partition,
  };
}
let saveTimer = null;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeState())); } catch (e) { /* storage unavailable: nothing to do */ } }, 150);
}
function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const d = raw ? JSON.parse(raw) : null;
    return d && d.v === 2 ? d : null;
  } catch (e) { return null; }
}
function applySnapshot(d) {
  state.hypotheses = [];
  for (const x of d.hyps || []) {
    try { const node = flatten(parseQuery(x.t).arg); state.hypotheses.push({ node, value: x.v, key: canonicalKey(node) }); } catch (e) { /* drop unreadable entry */ }
  }
  state.independentGroups = (d.indep || []).map(names => ({ names: names.slice() }));
  state.mutexPairs = (d.mutex || []).map(p => p.slice());
  state.partition = d.partition ? d.partition.slice() : null;
  if (typeof d.expr === 'string') $('exprInput').value = d.expr;
  if (typeof d.latex === 'string') $('latexInput').value = d.latex;
  activateTab(d.mode || 'text', false);
  renderHypothesesList();
  saveState();
}

// ---------------------------------------------------------------- context & validation
function buildContext(over) {
  const hyps = (over && over.hypotheses) || state.hypotheses;
  const groups = (over && over.independentGroups) || state.independentGroups;
  const mutex = (over && over.mutexPairs) || state.mutexPairs;
  const partition = over && 'partition' in over ? over.partition : state.partition;
  const knownProb = new Map();
  hyps.forEach(x => knownProb.set(x.key, x.value));
  return {
    knownProb,
    independentGroups: groups.map(g => new Set(g.names)),
    mutexPairs: new Set(mutex.map(p => pairKey(p[0], p[1]))),
    partition,
  };
}
// A change is refused only if it is what makes the facts contradictory --
// data that was already contradictory is reported in the results instead of
// blocking every further edit.
function problemIntroducedBy(over) {
  const before = findContextProblem(buildContext());
  const after = findContextProblem(buildContext(over));
  return after && !before ? after : null;
}

function getAllKnownAtoms() {
  const set = new Set();
  try { collectAtoms(parseQuery(getActiveInputText()).arg, set); } catch (e) { /* ignore unparsed input */ }
  state.hypotheses.forEach(x => collectAtoms(x.node, set));
  state.independentGroups.forEach(g => g.names.forEach(n => set.add(n)));
  state.mutexPairs.forEach(p => p.forEach(n => set.add(n)));
  if (state.partition) state.partition.forEach(n => set.add(n));
  return [...set].sort();
}

// ---------------------------------------------------------------- hypotheses
function showHypError(msg) {
  const el = $('hypError');
  el.textContent = msg || '';
  el.hidden = !msg;
}

// Adds (or updates) a known fact. Returns { ok, error, updated }.
function addFact(exprText, valueText) {
  const fail = error => ({ ok: false, error });
  exprText = (exprText || '').trim();
  valueText = valueText == null ? '' : String(valueText).trim();
  if (!exprText || !valueText) return fail('Nhập cả biểu thức và giá trị.');
  const value = parseValueInput(valueText);
  if (isNaN(value)) return fail('Giá trị phải là một số hoặc một phân số, vd 0.375 hoặc 3/8.');
  if (value < 0 || value > 1) return fail('Giá trị xác suất phải nằm trong đoạn [0, 1].');
  let node;
  try { node = flatten(parseQuery(exprText).arg); } catch (e) { return fail(e.message); }
  const key = canonicalKey(node);
  const idx = state.hypotheses.findIndex(x => x.key === key);
  const entry = { node, value, key };
  const next = state.hypotheses.slice();
  if (idx >= 0) next[idx] = entry; else next.push(entry);
  const problem = problemIntroducedBy({ hypotheses: next });
  if (problem) return fail('Giả thiết này làm các dữ kiện mâu thuẫn nhau. ' + problem);
  state.hypotheses = next;
  renderHypothesesList();
  saveState();
  return { ok: true, updated: idx >= 0 };
}

function removeWithUndo(label, mutate) {
  const snap = serializeState();
  mutate();
  renderHypothesesList();
  saveState();
  showToast(label, { action: { label: 'Hoàn tác', onClick: () => { applySnapshot(snap); } } });
}

function renderHypothesesList() {
  const list = $('hypothesesList');
  list.innerHTML = '';
  const total = state.hypotheses.length + state.independentGroups.length + state.mutexPairs.length + (state.partition ? 1 : 0);
  $('hypCount').textContent = total ? `(${total})` : '';
  if (!total) { list.append(h('p', { class: 'hint empty-hint', text: 'Chưa có giả thiết nào. Thêm bên dưới hoặc nạp một ví dụ mẫu.' })); return; }

  const row = (latexOrText, isLatex, removeLabel, onRemove) => {
    const eq = h('span', { class: 'hyp-eq' });
    if (isLatex) renderKatexTo(eq, latexOrText, false); else eq.textContent = latexOrText;
    return h('div', { class: 'hyp-row', role: 'listitem' }, eq,
      h('button', { type: 'button', class: 'hyp-remove', 'aria-label': removeLabel, title: 'Xóa', onclick: onRemove, text: '×' }));
  };

  state.hypotheses.forEach((x, i) => list.append(row(hypothesisLatex(x.node, x.value), true, 'Xóa giả thiết ' + plainFact(x),
    () => removeWithUndo('Đã xóa giả thiết ' + plainFact(x), () => state.hypotheses.splice(i, 1)))));
  state.independentGroups.forEach((g, i) => list.append(row(`Độc lập: ${g.names.join(', ')}`, false, 'Xóa khai báo độc lập ' + g.names.join(', '),
    () => removeWithUndo('Đã xóa khai báo độc lập', () => state.independentGroups.splice(i, 1)))));
  state.mutexPairs.forEach((p, i) => list.append(row(`Xung khắc: ${p.join(', ')}`, false, 'Xóa khai báo xung khắc ' + p.join(', '),
    () => removeWithUndo('Đã xóa khai báo xung khắc', () => state.mutexPairs.splice(i, 1)))));
  if (state.partition) list.append(row(`Phân hoạch: ${state.partition.join(', ')}`, false, 'Xóa khai báo phân hoạch ' + state.partition.join(', '),
    () => removeWithUndo('Đã xóa khai báo phân hoạch', () => { state.partition = null; })));
}

// ---------------------------------------------------------------- dialog
let modalOpener = null, modalKeyHandler = null;
function closeModal() {
  const bd = $('modalBackdrop');
  bd.hidden = true;
  if (modalKeyHandler) { bd.removeEventListener('keydown', modalKeyHandler); modalKeyHandler = null; }
  if (modalOpener && modalOpener.focus) modalOpener.focus();
  modalOpener = null;
}

function openModal(cfg) {
  const bd = $('modalBackdrop'), box = $('modalContent');
  modalOpener = document.activeElement;
  const selected = [];
  box.innerHTML = '';
  const summary = h('p', { class: 'hint modal-summary', 'aria-live': 'polite' });
  const errorEl = h('p', { class: 'field-error', role: 'alert', hidden: true });
  const confirmBtn = h('button', { type: 'button', class: 'btn-primary btn-compact', text: cfg.confirmLabel || 'Xác nhận', disabled: true });
  const chips = [];

  const refresh = () => {
    summary.textContent = selected.length ? 'Đã chọn: ' + selected.join(', ') : 'Chưa chọn biến cố nào.';
    const full = cfg.max != null && selected.length >= cfg.max;
    chips.forEach(c => {
      const on = selected.includes(c.dataset.name);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
      c.classList.toggle('selected', on);
      const blocked = full && !on;
      c.disabled = blocked;
      c.classList.toggle('disabled', blocked);
    });
    confirmBtn.disabled = selected.length < cfg.min;
    errorEl.hidden = true;
  };

  box.append(h('h3', { id: 'modalTitle', text: cfg.title }), h('p', { class: 'hint', text: cfg.description }));
  if (!cfg.atoms.length) {
    box.append(h('p', { class: 'hint', text: 'Chưa có biến cố nào. Hãy nhập biểu thức hoặc thêm giả thiết trước.' }));
  } else {
    const grid = h('div', { class: 'chip-grid', role: 'group', 'aria-label': 'Chọn biến cố' });
    cfg.atoms.forEach(name => {
      const chip = h('button', { type: 'button', class: 'chip-option', 'data-name': name, 'aria-pressed': 'false', text: name,
        onclick: () => {
          const i = selected.indexOf(name);
          if (i >= 0) selected.splice(i, 1); else if (cfg.max == null || selected.length < cfg.max) selected.push(name);
          refresh();
        } });
      chip.style.setProperty('--chip-color', colorOf(name));
      chips.push(chip); grid.append(chip);
    });
    box.append(grid);
  }
  confirmBtn.addEventListener('click', () => {
    const err = cfg.onConfirm(selected.slice());
    if (err) { errorEl.textContent = err; errorEl.hidden = false; return; }
    closeModal();
  });
  box.append(summary, errorEl, h('div', { class: 'modal-actions' },
    h('button', { type: 'button', class: 'btn btn-small', text: 'Hủy', onclick: closeModal }), confirmBtn));

  bd.hidden = false;
  refresh();
  modalKeyHandler = e => {
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
    if (e.key !== 'Tab') return;
    const f = [...box.querySelectorAll('button:not([disabled])')];
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  bd.addEventListener('keydown', modalKeyHandler);
  (chips[0] || box.querySelector('button')).focus();
}

function declare(kind, names) {
  if (kind === 'indep') {
    const next = state.independentGroups.concat([{ names }]);
    const problem = problemIntroducedBy({ independentGroups: next });
    if (problem) return 'Khai báo này làm các dữ kiện mâu thuẫn nhau. ' + problem;
    state.independentGroups = next;
  } else if (kind === 'mutex') {
    const next = state.mutexPairs.concat([names]);
    const problem = problemIntroducedBy({ mutexPairs: next });
    if (problem) return 'Khai báo này làm các dữ kiện mâu thuẫn nhau. ' + problem;
    state.mutexPairs = next;
  } else {
    const problem = problemIntroducedBy({ partition: names });
    if (problem) return 'Phân hoạch này không khớp với các giả thiết hiện có. ' + problem;
    state.partition = names;
  }
  renderHypothesesList();
  saveState();
  return null;
}

// ---------------------------------------------------------------- image input
function renderImageReview(lines, canvas) {
  const area = $('imgReviewArea');
  area.innerHTML = '';
  if (!lines.length) return;
  const rows = [];
  const allBtn = h('button', { type: 'button', class: 'btn btn-small', hidden: true });

  const refreshAll = () => {
    const n = rows.filter(r => r.hyp() && !r.added).length;
    allBtn.hidden = rows.filter(r => r.hyp()).length < 2;
    allBtn.textContent = `+ Thêm tất cả ${n} dòng làm giả thiết`;
    allBtn.disabled = n === 0;
  };

  lines.forEach((line, i) => {
    const inputId = 'imgLine' + i;
    const input = h('input', { type: 'text', id: inputId, class: 'line-text mono', value: line.text, spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off' });
    input.value = line.text;
    const tag = h('span', { class: 'line-tag', text: 'dạng giả thiết', hidden: true });
    const addBtn = h('button', { type: 'button', class: 'btn btn-small', text: '+ Thêm giả thiết', hidden: true });
    const useBtn = h('button', { type: 'button', class: 'btn btn-small', text: 'Dùng làm biểu thức' });
    const r = { added: false, hyp: () => tryLineAsHypothesis(input.value) };
    rows.push(r);
    const sync = () => {
      const hyp = r.hyp();
      tag.hidden = !hyp; addBtn.hidden = !hyp;
      addBtn.disabled = r.added; addBtn.textContent = r.added ? 'Đã thêm ✓' : '+ Thêm giả thiết';
      refreshAll();
    };
    input.addEventListener('input', () => { r.added = false; sync(); });
    addBtn.addEventListener('click', () => {
      const hyp = r.hyp(); if (!hyp) return;
      const res = addFact(hyp.exprPart, String(hyp.value));
      if (!res.ok) { showHypError(res.error); showToast(`Dòng ${i + 1}: ${res.error}`, { kind: 'error' }); return; }
      showHypError(''); r.added = true; sync();
    });
    useBtn.addEventListener('click', () => {
      $('exprInput').value = input.value;
      activateTab('text', false);
      $('exprInput').focus();
      showToast('Đã đưa dòng này vào ô biểu thức.');
    });
    area.append(h('div', { class: 'review-row' },
      h('img', { class: 'review-thumb', alt: `Dòng ${i + 1} trong ảnh`, src: bandThumb(canvas, line.top, line.bottom) }),
      h('div', { class: 'review-main' },
        h('label', { class: 'sr-only', for: inputId, text: `Chữ nhận diện được ở dòng ${i + 1}, có thể sửa` }), input, tag),
      h('div', { class: 'review-actions' }, addBtn, useBtn)));
    sync();
  });

  allBtn.addEventListener('click', () => {
    let added = 0;
    rows.forEach((r, i) => {
      const hyp = r.hyp();
      if (!hyp || r.added) return;
      const res = addFact(hyp.exprPart, String(hyp.value));
      if (res.ok) { r.added = true; added++; } else showToast(`Dòng ${i + 1}: ${res.error}`, { kind: 'error' });
    });
    area.querySelectorAll('.review-row').forEach((el, i) => {
      const b = el.querySelector('.review-actions .btn'); if (rows[i].added && b) { b.disabled = true; b.textContent = 'Đã thêm ✓'; }
    });
    refreshAll();
    if (added) showToast(`Đã thêm ${added} giả thiết.`);
  });
  area.append(h('div', { class: 'review-footer' }, allBtn));
  refreshAll();
}

function bandThumb(canvas, top, bottom) {
  const pad = 4, y0 = Math.max(0, top - pad), y1 = Math.min(canvas.height - 1, bottom + pad), hh = y1 - y0 + 1;
  const scale = Math.min(1, 44 / hh);
  const w = Math.max(1, Math.round(canvas.width * scale)), th = Math.max(1, Math.round(hh * scale));
  const c = makeCanvasEl(w, th);
  c.getContext('2d').drawImage(canvas, 0, y0, canvas.width, hh, 0, 0, w, th);
  return c.toDataURL('image/png');
}

function setImgStatus(msg) { $('imgStatus').textContent = msg || ''; }

function handleImageFile(file) {
  if (!file) return;
  if (!/^image\//.test(file.type)) { setImgStatus('Tệp này không phải ảnh.'); return; }
  if (file.size > 20 * 1024 * 1024) { setImgStatus('Ảnh quá lớn (tối đa 20 MB).'); return; }
  setImgStatus('Đang xử lý ảnh…');
  $('imgReviewArea').innerHTML = '';
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      $('imgPreview').src = reader.result;
      $('imgPreviewWrap').hidden = false;
      // modest upscaling of small crops so thin strokes survive thresholding
      const scale = img.width > 1000 ? 1000 / img.width : (img.width < 400 ? Math.min(2, 640 / img.width) : 1);
      const canvas = makeCanvasEl(Math.max(1, Math.round(img.width * scale)), Math.max(1, Math.round(img.height * scale)));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let lines;
      try { lines = recognizeLinesDetailed(canvas, getImgTemplates(), makeCanvasEl); }
      catch (e) { setImgStatus('Không xử lý được ảnh này: ' + e.message); return; }
      lines = lines.filter(l => l.text.trim());
      if (!lines.length) { setImgStatus('Không tìm thấy chữ nào trong ảnh. Thử ảnh rõ nét và cắt sát phần chữ hơn.'); return; }
      if (lines.length === 1 && !lines[0].text.includes('=')) {
        $('exprInput').value = lines[0].text;
        activateTab('text', false);
        setImgStatus(`Đã nhận diện: “${lines[0].text}” — kiểm tra và sửa lại nếu cần trước khi bấm Giải.`);
        showToast('Đã đưa kết quả nhận diện vào ô biểu thức. Hãy kiểm tra lại trước khi giải.');
        saveState();
        return;
      }
      setImgStatus(`Đã nhận diện ${lines.length} dòng — kiểm tra, sửa chữ nếu sai, rồi chọn cách dùng cho từng dòng.`);
      renderImageReview(lines, canvas);
    };
    img.onerror = () => setImgStatus('Không đọc được ảnh này.');
    img.src = reader.result;
  };
  reader.onerror = () => setImgStatus('Không đọc được tệp ảnh.');
  reader.readAsDataURL(file);
}

// ---------------------------------------------------------------- export
function buildLatexSource(steps, queryLatex, finalResult) {
  const finalLine = `${queryLatex} = ${finalResult.numeric != null ? fmtNum(finalResult.numeric) : finalResult.latex}`;
  if (!steps.length) return finalLine;
  return '\\begin{gathered}\n' + steps.map(s => s.eq).join(' \\\\\n') + ' \\\\\n' + finalLine + '\n\\end{gathered}';
}
function copyLatexSolution(steps, queryLatex, finalResult, btn) {
  const tex = buildLatexSource(steps, queryLatex, finalResult);
  const done = () => { const old = btn.textContent; btn.textContent = 'Đã sao chép ✓'; setTimeout(() => { btn.textContent = old; }, 1600); };
  const fallback = () => showToast('Trình duyệt chặn sao chép tự động. Hãy dùng nút “Tải .tex” thay thế.', { kind: 'error' });
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(tex).then(done).catch(fallback);
  else fallback();
}
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = h('a', { download: name, href: url });
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function downloadLatexFile(steps, queryLatex, finalResult) {
  downloadBlob(new Blob([buildLatexSource(steps, queryLatex, finalResult)], { type: 'text/x-tex;charset=utf-8' }), 'loi-giai.tex');
}
function downloadResultsPng(el) {
  if (typeof html2canvas === 'undefined') { showToast('Không tải được thư viện tạo ảnh (cần mạng).', { kind: 'error' }); return; }
  html2canvas(el, { backgroundColor: '#1F2926', scale: 2 }).then(canvas => {
    const link = h('a', { download: 'loi-giai.png', href: canvas.toDataURL('image/png') });
    document.body.append(link); link.click(); link.remove();
  }).catch(() => showToast('Không tạo được ảnh để tải về.', { kind: 'error' }));
}

// ---------------------------------------------------------------- solving
function runSolve() {
  const body = $('resultsBody');
  body.innerHTML = '';
  const note = (text, kind) => { body.append(h('p', { class: kind === 'error' ? 'result-error' : 'hint', role: kind === 'error' ? 'alert' : null, text })); return null; };

  const text = getActiveInputText();
  if (!text.trim()) { note('Hãy nhập một biểu thức trước.'); return; }
  let query;
  try { query = parseQuery(text); } catch (e) { note('Không đọc được biểu thức: ' + e.message, 'error'); return; }
  const queryNode = flatten(query.arg);
  const ctx = buildContext();
  let out;
  try { out = solveQuery(queryNode, ctx, colorOf); } catch (e) { note('Có lỗi khi giải biểu thức này: ' + e.message, 'error'); return; }

  const queryLatex = toProbLatex(queryNode, colorOf);
  const finalResult = { numeric: out.numeric, latex: out.latex };
  const venn = out.atoms.length ? computeMinterms(out.atoms, ctx, out.model) : null;

  // --- warnings: contradictory facts first, else any out-of-range result
  const warnings = [];
  if (out.model && out.model.problem) warnings.push(out.model.problem.text);
  else if (venn) consistencyWarnings(venn.names, venn.regions, out.numeric).forEach(w => warnings.push(w.text));
  if (warnings.length) {
    body.append(h('div', { class: 'banner banner-danger', role: 'alert' },
      h('strong', { text: 'Các giả thiết có vẻ mâu thuẫn. ' }), warnings.join(' ')));
  }

  // --- result card
  const toolbar = h('div', { class: 'result-tools' });
  const copyBtn = h('button', { type: 'button', class: 'btn btn-small', text: 'Sao chép LaTeX' });
  copyBtn.addEventListener('click', () => copyLatexSolution(out.steps, queryLatex, finalResult, copyBtn));
  toolbar.append(copyBtn,
    h('button', { type: 'button', class: 'btn btn-small', text: 'Tải .tex', onclick: () => downloadLatexFile(out.steps, queryLatex, finalResult) }),
    h('button', { type: 'button', class: 'btn btn-small', text: 'Tải ảnh PNG', onclick: () => downloadResultsPng(body) }));

  const ans = h('div', { class: 'result-answer' });
  let spoken;
  if (out.numeric != null) {
    const fr = bestFraction(out.numeric);
    let tex = `${queryLatex} = ${fmtNum(out.numeric)}`;
    if (fr && fr.q > 1) tex += (fr.exact ? ' = ' : ' \\approx ') + `\\dfrac{${fr.p}}{${fr.q}}`;
    renderKatexTo(ans, tex, true);
    spoken = `Kết quả: ${fmtNum(out.numeric)}` + (fr && fr.q > 1 ? `, tức ${fr.p} phần ${fr.q}` : '');
  } else {
    renderKatexTo(ans, `${queryLatex} = ${out.latex}`, true);
    spoken = 'Chưa đủ giả thiết để tính ra số.';
  }
  const card = h('section', { class: 'result-card' + (out.numeric == null ? ' unresolved' : ''), 'aria-labelledby': 'resLabel' },
    h('div', { class: 'result-head' }, h('h3', { id: 'resLabel', class: 'result-label', text: 'Kết quả' }), toolbar), ans);
  if (out.numeric != null) card.append(h('p', { class: 'result-aux', text: `≈ ${fmtNum(out.numeric * 100)}%` + (out.via === 'linear' ? ' · suy ngược bằng hệ phương trình tuyến tính' : '') }));
  else {
    card.append(h('p', { class: 'missing-note', text: 'Chưa đủ giả thiết để tính ra số.' + (out.missing && out.missing.size ? ' Còn thiếu giá trị cho: ' + [...out.missing].join(', ') + '.' : '') + ' Thử thêm giả thiết hoặc khai báo độc lập / xung khắc / phân hoạch nếu đề bài có nói.' }));
  }
  body.append(card);

  // --- steps
  body.append(h('h3', { class: 'section-title', text: 'Các bước giải' }));
  if (!out.steps.length) {
    body.append(h('p', { class: 'hint', text: 'Biểu thức này trùng khớp trực tiếp với một giả thiết đã biết, không cần khai triển thêm.' }));
  } else {
    const ol = h('ol', { class: 'steps' });
    out.steps.forEach(s => {
      const eq = h('div', { class: 'step-eq' });
      renderKatexTo(eq, s.eq, true);
      ol.append(h('li', { class: 'step' }, h('div', { class: 'step-rule', text: s.rule }), eq, s.note ? h('p', { class: 'step-note', text: s.note }) : null));
    });
    body.append(ol);
  }

  // --- Venn
  if (venn) {
    const diagram = renderVennDiagram(venn.names, venn.regions, colorOf);
    if (diagram) {
      body.append(h('h3', { class: 'section-title', text: 'Biểu đồ Venn' }));
      if (diagram.svg) {
        const wrap = h('div', { id: 'vennSvgContainer', class: 'venn-wrap', role: 'img', 'aria-label': 'Biểu đồ Venn của ' + venn.names.join(', ') + '; bảng số liệu các vùng nằm bên dưới' });
        wrap.innerHTML = diagram.svg;
        body.append(wrap);
        const tbl = renderVennTable(venn.names, venn.regions, colorOf);
        const det = h('details', { class: 'venn-data' }, h('summary', { text: 'Xem bảng số liệu các vùng' }));
        const tw = h('div', { class: 'table-wrap' }); tw.innerHTML = tbl.html; det.append(tw);
        body.append(det);
      } else if (diagram.isTable) {
        const tw = h('div', { id: 'vennTableWrap', class: 'table-wrap' }); tw.innerHTML = diagram.html;
        body.append(tw, h('p', { class: 'hint', text: `Từ 5 tập hợp trở lên không thể vẽ Venn bằng đường cong lồi mà vẫn đủ mọi vùng giao, nên hiển thị dạng bảng liệt kê cả ${Math.pow(2, venn.names.length)} vùng.` }));
      }
    }
  }

  $('liveStatus').textContent = 'Đã giải xong. ' + spoken;
  if (window.matchMedia && window.matchMedia('(max-width: 899px)').matches && $('resultsPanel').scrollIntoView) {
    $('resultsPanel').scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }
}

// ---------------------------------------------------------------- examples
const EXAMPLES = [
  { id: 'pie2', label: 'Bù trừ — 2 biến cố', expr: 'P(A U B)', facts: [['A', 0.5], ['B', 0.3], ['A n B', 0.1]] },
  { id: 'pie3', label: 'Bù trừ — 3 biến cố', expr: 'P(A U B U C)', facts: [['A', 0.3], ['B', 0.4], ['C', 0.5], ['A n B', 0.1], ['A n C', 0.15], ['B n C', 0.2], ['A n B n C', 0.05]] },
  { id: 'indep', label: 'Hai biến cố độc lập', expr: 'P(A U B)', facts: [['A', 0.5], ['B', 0.4]], indep: [['A', 'B']] },
  { id: 'mutex', label: 'Hai biến cố xung khắc', expr: 'P(A U B)', facts: [['A', 0.3], ['B', 0.2]], mutex: [['A', 'B']] },
  { id: 'cond', label: 'Xác suất có điều kiện', expr: 'P(B|A)', facts: [['A', 0.5], ['AB', 0.2]] },
  { id: 'inverse', label: 'Suy ngược: tìm P(A∩B) từ P(A∪B)', expr: 'P(A n B)', facts: [['A', 0.5], ['B', 0.6], ['A U B', 0.8]] },
  { id: 'bayes', label: 'Bayes & xác suất toàn phần', expr: 'P(B1|A)', facts: [['B1', 0.3], ['B2', 0.5], ['B3', 0.2], ['A|B1', 0.1], ['A|B2', 0.2], ['A|B3', 0.05]], partition: ['B1', 'B2', 'B3'] },
  { id: 'four', label: '4 biến cố, dữ kiện điều kiện ẩn', expr: 'P(A U B U C U D)', facts: [['A', 0.3], ['B', 0.3], ['C', 0.4], ['D', 0.4], ['A n B', 0.1], ['A n C', 0.1], ['A n D', 0.1], ['B n C', 0.1], ['B n D', 0.1], ['C|D', 0.375], ['A n B n C', 0.03], ['A n B n D', 0.03], ['C n D | A', '2/15'], ['D | B n C', 0.4], ['A n B n C n D', 0.01]] },
];

function loadExample(id, solve) {
  const ex = EXAMPLES.find(e => e.id === id);
  if (!ex) return;
  state.hypotheses = []; state.independentGroups = []; state.mutexPairs = []; state.partition = null;
  ex.facts.forEach(([e, v]) => {
    const node = flatten(parseQuery(e).arg);
    state.hypotheses.push({ node, value: parseValueInput(String(v)), key: canonicalKey(node) });
  });
  (ex.indep || []).forEach(names => state.independentGroups.push({ names }));
  (ex.mutex || []).forEach(p => state.mutexPairs.push(p));
  state.partition = ex.partition || null;
  $('exprInput').value = ex.expr;
  activateTab('text', false);
  showHypError('');
  renderHypothesesList();
  saveState();
  if (solve) runSolve();
}

// ---------------------------------------------------------------- wiring
function submitHypothesis() {
  let exprText = $('hypExpr').value, valueText = $('hypValue').value;
  if (!valueText.trim() && exprText.includes('=')) {
    const hyp = tryLineAsHypothesis(exprText);
    if (hyp) { exprText = hyp.exprPart; valueText = String(hyp.value); }
  }
  const res = addFact(exprText, valueText);
  if (!res.ok) { showHypError(res.error); return; }
  showHypError('');
  $('hypExpr').value = ''; $('hypValue').value = '';
  $('hypExpr').focus();
  if (res.updated) showToast('Đã cập nhật giá trị của giả thiết đã có.');
}

function init() {
  const sel = $('exampleSelect');
  EXAMPLES.forEach(e => sel.append(h('option', { value: e.id, text: e.label })));
  sel.addEventListener('change', () => { if (sel.value) loadExample(sel.value, true); sel.value = ''; });

  // tabs: click + arrow-key navigation
  tabEls().forEach(t => t.addEventListener('click', () => activateTab(t.dataset.mode, false)));
  document.querySelector('.tabs').addEventListener('keydown', e => {
    const list = tabEls(); const i = list.findIndex(t => t === document.activeElement);
    if (i < 0) return;
    const go = { ArrowRight: (i + 1) % list.length, ArrowLeft: (i - 1 + list.length) % list.length, Home: 0, End: list.length - 1 }[e.key];
    if (go == null) return;
    e.preventDefault(); activateTab(list[go].dataset.mode, true);
  });

  // hypothesis form
  $('addHypForm').addEventListener('submit', e => { e.preventDefault(); submitHypothesis(); });
  $('hypExpr').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !$('hypValue').value.trim() && !$('hypExpr').value.includes('=')) { e.preventDefault(); $('hypValue').focus(); }
  });
  $('addIndepBtn').addEventListener('click', () => openModal({
    title: 'Khai báo các biến cố độc lập', description: 'Chọn từ 2 biến cố trở lên độc lập (từng đôi và cả nhóm) với nhau.',
    atoms: getAllKnownAtoms(), min: 2, max: null, confirmLabel: 'Xác nhận', onConfirm: names => declare('indep', names),
  }));
  $('addMutexBtn').addEventListener('click', () => openModal({
    title: 'Khai báo hai biến cố xung khắc', description: 'Chọn đúng 2 biến cố không thể cùng xảy ra (giao bằng rỗng).',
    atoms: getAllKnownAtoms(), min: 2, max: 2, confirmLabel: 'Xác nhận', onConfirm: names => declare('mutex', names),
  }));
  $('setPartitionBtn').addEventListener('click', () => openModal({
    title: 'Khai báo một phân hoạch', description: 'Chọn các biến cố đôi một xung khắc và hợp lại là cả không gian mẫu (cần cho xác suất toàn phần và Bayes).',
    atoms: getAllKnownAtoms(), min: 2, max: null, confirmLabel: 'Đặt phân hoạch', onConfirm: names => declare('partition', names),
  }));
  $('modalBackdrop').addEventListener('mousedown', e => { if (e.target === $('modalBackdrop')) closeModal(); });
  $('clearHypBtn').addEventListener('click', () => {
    const n = state.hypotheses.length + state.independentGroups.length + state.mutexPairs.length + (state.partition ? 1 : 0);
    if (!n) return;
    removeWithUndo(`Đã xóa ${n} giả thiết và khai báo`, () => { state.hypotheses = []; state.independentGroups = []; state.mutexPairs = []; state.partition = null; });
    showHypError('');
  });

  // solve: button, Enter in the single-line inputs, Ctrl/Cmd+Enter anywhere
  $('solveBtn').addEventListener('click', runSolve);
  ['exprInput', 'latexInput'].forEach(id => $(id).addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runSolve(); }
  }));
  $('exprInput').addEventListener('input', saveState);
  $('latexInput').addEventListener('input', saveState);
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && $('modalBackdrop').hidden) { e.preventDefault(); runSolve(); }
  });

  // image: pick, drop, paste
  const drop = $('imageDrop'), fileInput = $('imageFile');
  drop.addEventListener('click', () => fileInput.click());
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  fileInput.addEventListener('change', () => { handleImageFile(fileInput.files[0]); fileInput.value = ''; });
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('dragging'); }));
  drop.addEventListener('drop', e => handleImageFile(e.dataTransfer && e.dataTransfer.files[0]));
  document.addEventListener('paste', e => {
    const item = [...((e.clipboardData && e.clipboardData.items) || [])].find(i => i.type && i.type.startsWith('image/'));
    if (!item) return;
    e.preventDefault(); activateTab('image', false); handleImageFile(item.getAsFile());
  });

  const saved = loadSavedState();
  if (saved) applySnapshot(saved); else loadExample('pie3', false);
  renderHypothesesList();
  if (typeof katex === 'undefined') showToast('Chưa tải được KaTeX (cần mạng lần đầu) nên công thức tạm hiện dưới dạng mã LaTeX.', { kind: 'error', timeout: 9000 });
}

init();
