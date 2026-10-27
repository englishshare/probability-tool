/* ============================================================
   UI CONTROLLER: state, rendering, and event wiring.
   ============================================================ */
const state = {
  hypotheses: [],          // { node, value, key }
  independentGroups: [],   // [{ names: [...] }]
  mutexPairs: [],          // [[nameA, nameB]]
  partition: null,         // [names...] | null
  colorMap: new Map(),
  colorPalette: ['#7EB6D9', '#E38C7A', '#79C9A4', '#C9A6E0', '#E0B979', '#8FA9D9'],
};

function colorOf(name) {
  if (!state.colorMap.has(name)) {
    state.colorMap.set(name, state.colorPalette[state.colorMap.size % state.colorPalette.length]);
  }
  return state.colorMap.get(name);
}

function renderKatexTo(el, latex, displayMode) {
  try { katex.render(latex, el, { displayMode: !!displayMode, throwOnError: false }); }
  catch (e) { el.textContent = latex; }
}

function hypothesisLatex(node, value) {
  if (node.type === 'COND') {
    return `P\\left(${toLatex(node.arg, colorOf)} \\mid ${toLatex(node.given, colorOf)}\\right) = ${fmtNum(value)}`;
  }
  return `${toProbLatex(node, colorOf)} = ${fmtNum(value)}`;
}

function getActiveMode() { return document.querySelector('.tab.active').dataset.mode; }
function getActiveInputText() {
  return getActiveMode() === 'latex'
    ? document.getElementById('latexInput').value
    : document.getElementById('exprInput').value;
}

function getAllKnownAtoms() {
  const set = new Set();
  try { collectAtoms(parseQuery(getActiveInputText()).arg, set); } catch (e) { /* ignore unparsed input */ }
  state.hypotheses.forEach(h => collectAtoms(h.node, set));
  state.independentGroups.forEach(g => g.names.forEach(n => set.add(n)));
  state.mutexPairs.forEach(p => p.forEach(n => set.add(n)));
  if (state.partition) state.partition.forEach(n => set.add(n));
  return [...set].sort();
}

function renderHypothesesList() {
  const container = document.getElementById('hypothesesList');
  container.innerHTML = '';
  state.hypotheses.forEach((h, idx) => {
    const row = document.createElement('div'); row.className = 'hyp-row';
    const eqSpan = document.createElement('span'); eqSpan.className = 'hyp-eq';
    renderKatexTo(eqSpan, hypothesisLatex(h.node, h.value), false);
    row.appendChild(eqSpan);
    const btn = document.createElement('button'); btn.className = 'hyp-remove'; btn.textContent = '✕';
    btn.title = 'Xóa giả thiết này';
    btn.onclick = () => { state.hypotheses.splice(idx, 1); renderHypothesesList(); };
    row.appendChild(btn);
    container.appendChild(row);
  });
  state.independentGroups.forEach((g, idx) => {
    const row = document.createElement('div'); row.className = 'hyp-row';
    const span = document.createElement('span'); span.className = 'hyp-eq';
    span.textContent = 'Độc lập: ' + g.names.join(', ');
    row.appendChild(span);
    const btn = document.createElement('button'); btn.className = 'hyp-remove'; btn.textContent = '✕';
    btn.onclick = () => { state.independentGroups.splice(idx, 1); renderHypothesesList(); };
    row.appendChild(btn);
    container.appendChild(row);
  });
  state.mutexPairs.forEach((p, idx) => {
    const row = document.createElement('div'); row.className = 'hyp-row';
    const span = document.createElement('span'); span.className = 'hyp-eq';
    span.textContent = 'Xung khắc: ' + p.join(', ');
    row.appendChild(span);
    const btn = document.createElement('button'); btn.className = 'hyp-remove'; btn.textContent = '✕';
    btn.onclick = () => { state.mutexPairs.splice(idx, 1); renderHypothesesList(); };
    row.appendChild(btn);
    container.appendChild(row);
  });
  if (state.partition) {
    const row = document.createElement('div'); row.className = 'hyp-row';
    const span = document.createElement('span'); span.className = 'hyp-eq';
    span.textContent = 'Phân hoạch: {' + state.partition.join(', ') + '}';
    row.appendChild(span);
    const btn = document.createElement('button'); btn.className = 'hyp-remove'; btn.textContent = '✕';
    btn.onclick = () => { state.partition = null; renderHypothesesList(); };
    row.appendChild(btn);
    container.appendChild(row);
  }
}

function showHypError(msg) {
  const el = document.getElementById('hypError');
  el.textContent = msg; el.style.display = msg ? 'block' : 'none';
}

// Accepts a plain decimal ("0.375") or a simple fraction ("3/8", spaces
// around the slash allowed) -- fractions are common in these problems
// (thirds, sevenths...) and don't always have a clean decimal form.
function parseValueInput(text) {
  const s = text.trim();
  const m = s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
  if (m) {
    const num = parseFloat(m[1]), den = parseFloat(m[2]);
    return den === 0 ? NaN : num / den;
  }
  return parseFloat(s);
}

function addHypothesisFromText(exprText, valueText) {
  showHypError('');
  if (!exprText || valueText === '' || valueText == null) { showHypError('Nhập cả biểu thức và giá trị.'); return false; }
  const value = parseValueInput(valueText);
  if (isNaN(value)) { showHypError('Giá trị phải là một số hoặc một phân số, vd 0.375 hoặc 3/8.'); return false; }
  if (value < 0 || value > 1) { showHypError('Giá trị xác suất phải nằm trong đoạn [0, 1].'); return false; }
  try {
    // parseQuery accepts either a bare set expression ("A n B") or one
    // wrapped in P(...) ("P(A n B)") -- typing it either way just works.
    const node = flatten(parseQuery(exprText).arg);
    state.hypotheses.push({ node, value, key: canonicalKey(node) });
    renderHypothesesList();
    return true;
  } catch (e) {
    showHypError('Không đọc được biểu thức "' + exprText + '": ' + e.message);
    return false;
  }
}
document.getElementById('addHypBtn').onclick = () => {
  const exprText = document.getElementById('hypExpr').value.trim();
  const valueText = document.getElementById('hypValue').value.trim();
  if (addHypothesisFromText(exprText, valueText)) {
    document.getElementById('hypExpr').value = '';
    document.getElementById('hypValue').value = '';
  }
};
document.getElementById('hypExpr').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('addHypBtn').click();
});
document.getElementById('hypValue').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('addHypBtn').click();
});

document.getElementById('clearHypBtn').onclick = () => {
  state.hypotheses = []; state.independentGroups = []; state.mutexPairs = []; state.partition = null;
  renderHypothesesList();
};

// ---------- modal (independence / mutex / partition chip pickers) ----------
function openModal(title, description, atomOptions, minSelect, maxSelect, onConfirm) {
  const backdrop = document.getElementById('modalBackdrop');
  const content = document.getElementById('modalContent');
  const selected = new Set();
  function render() {
    content.innerHTML = '';
    const h3 = document.createElement('h3'); h3.textContent = title; content.appendChild(h3);
    if (description) {
      const desc = document.createElement('p'); desc.className = 'hint'; desc.style.marginTop = '-6px'; desc.textContent = description;
      content.appendChild(desc);
    }
    const field = document.createElement('div'); field.className = 'modal-field';
    const label = document.createElement('label');
    label.textContent = atomOptions.length ? 'Bấm để chọn / bỏ chọn:' : 'Chưa có tập hợp nào để chọn — hãy nhập biểu thức hoặc thêm một giả thiết có tên tập hợp trước, rồi mở lại mục này.';
    field.appendChild(label);
    const chipWrap = document.createElement('div'); chipWrap.className = 'chip-select';
    const atMax = !!(maxSelect && selected.size >= maxSelect);
    atomOptions.forEach(name => {
      const chip = document.createElement('div');
      const isSel = selected.has(name);
      const disabled = atMax && !isSel;
      chip.className = 'chip-option' + (isSel ? ' selected' : '') + (disabled ? ' disabled' : '');
      chip.textContent = name;
      if (isSel) { chip.style.background = colorOf(name); chip.style.borderColor = colorOf(name); chip.style.color = '#1a1e1c'; }
      chip.onclick = () => {
        if (selected.has(name)) selected.delete(name);
        else { if (atMax) return; selected.add(name); }
        render();
      };
      chipWrap.appendChild(chip);
    });
    field.appendChild(chipWrap);
    content.appendChild(field);
    const summary = document.createElement('p'); summary.className = 'hint'; summary.style.minHeight = '18px';
    summary.textContent = selected.size ? 'Đã chọn: ' + [...selected].join(', ') : '';
    content.appendChild(summary);
    const actions = document.createElement('div'); actions.className = 'modal-actions';
    const cancelBtn = document.createElement('button'); cancelBtn.className = 'btn'; cancelBtn.textContent = 'Hủy';
    cancelBtn.onclick = closeModal;
    const okBtn = document.createElement('button'); okBtn.className = 'btn'; okBtn.style.background = 'var(--accent)'; okBtn.style.color = '#262017'; okBtn.style.border = 'none';
    okBtn.textContent = 'Xác nhận';
    const canConfirm = selected.size >= minSelect;
    okBtn.style.opacity = canConfirm ? '1' : '0.5';
    okBtn.onclick = () => { if (!canConfirm) return; onConfirm([...selected]); closeModal(); };
    actions.appendChild(cancelBtn); actions.appendChild(okBtn);
    content.appendChild(actions);
  }
  render();
  backdrop.classList.add('open');
}
function closeModal() { document.getElementById('modalBackdrop').classList.remove('open'); }
document.getElementById('modalBackdrop').addEventListener('click', e => { if (e.target.id === 'modalBackdrop') closeModal(); });

document.getElementById('addIndepBtn').onclick = () => {
  openModal('Khai báo các biến cố độc lập',
    'Chọn từ 2 biến cố trở lên thực sự độc lập với nhau. Lúc giải, công cụ sẽ tính P(giao của chúng) = tích các xác suất riêng.',
    getAllKnownAtoms(), 2, null, names => {
      state.independentGroups.push({ names }); renderHypothesesList();
    });
};
document.getElementById('addMutexBtn').onclick = () => {
  openModal('Khai báo 2 biến cố xung khắc',
    'Chọn đúng 2 biến cố không thể cùng xảy ra (không giao nhau). Công cụ sẽ coi P(giao của 2 biến cố này) = 0.',
    getAllKnownAtoms(), 2, 2, names => {
      state.mutexPairs.push(names.slice(0, 2)); renderHypothesesList();
    });
};
document.getElementById('setPartitionBtn').onclick = () => {
  openModal('Khai báo một phân hoạch',
    'Chọn các biến cố cùng nhau lấp đầy không gian mẫu và không chồng lấn (vd B1, B2, B3). Sau khi chọn, hãy thêm giả thiết P(Bi) và P(A|Bi) cho từng biến cố — công cụ sẽ tự dùng định lý Bayes hoặc công thức xác suất toàn phần khi cần. Khai báo mới sẽ thay thế phân hoạch cũ (nếu có).',
    getAllKnownAtoms(), 2, null, names => {
      state.partition = names; renderHypothesesList();
    });
};

// ---------- input tabs ----------
document.querySelectorAll('.tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.input-pane').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('pane-' + tab.dataset.mode).classList.add('active');
  };
});

// ---------- image input ----------
const imageDrop = document.getElementById('imageDrop');
const imageFileInput = document.getElementById('imageFile');
imageDrop.onclick = () => imageFileInput.click();
imageDrop.ondragover = e => { e.preventDefault(); };
imageDrop.ondrop = e => { e.preventDefault(); if (e.dataTransfer.files[0]) handleImageFile(e.dataTransfer.files[0]); };
imageFileInput.onchange = () => { if (imageFileInput.files[0]) handleImageFile(imageFileInput.files[0]); };

function tryLineAsHypothesis(line) {
  const idx = line.lastIndexOf('=');
  if (idx === -1) return null;
  const exprPart = line.slice(0, idx).trim();
  const valuePart = line.slice(idx + 1).trim();
  const value = parseValueInput(valuePart);
  if (!exprPart || isNaN(value) || !isFinite(value)) return null;
  try { flatten(parseQuery(exprPart).arg); return { exprPart, value }; }
  catch (e) { return null; }
}

function renderImageLinesReview(lines) {
  const reviewArea = document.getElementById('imgReviewArea');
  reviewArea.innerHTML = '';
  const equationLines = [];
  lines.forEach(line => {
    const row = document.createElement('div'); row.className = 'img-review-line';
    const textSpan = document.createElement('span'); textSpan.className = 'line-text'; textSpan.textContent = line;
    row.appendChild(textSpan);
    const asHyp = tryLineAsHypothesis(line);
    if (asHyp) {
      equationLines.push({ line, exprPart: asHyp.exprPart, value: asHyp.value });
      const tag = document.createElement('span'); tag.className = 'line-tag'; tag.textContent = 'dạng giả thiết';
      row.appendChild(tag);
      const addBtn = document.createElement('button'); addBtn.className = 'btn btn-small'; addBtn.textContent = '+ Thêm giả thiết';
      addBtn.onclick = () => {
        if (addHypothesisFromText(asHyp.exprPart, String(asHyp.value))) { addBtn.textContent = 'Đã thêm ✓'; addBtn.disabled = true; }
      };
      row.appendChild(addBtn);
    }
    const useBtn = document.createElement('button'); useBtn.className = 'btn btn-small'; useBtn.textContent = 'Dùng làm biểu thức';
    useBtn.onclick = () => {
      document.getElementById('exprInput').value = line;
      document.querySelector('.tab[data-mode="text"]').click();
    };
    row.appendChild(useBtn);
    reviewArea.appendChild(row);
  });
  if (equationLines.length > 1) {
    const allBtn = document.createElement('button'); allBtn.className = 'btn'; allBtn.style.marginTop = '8px';
    allBtn.textContent = '+ Thêm tất cả ' + equationLines.length + ' dòng làm giả thiết';
    allBtn.onclick = () => {
      let ok = 0;
      equationLines.forEach(h => { if (addHypothesisFromText(h.exprPart, String(h.value))) ok++; });
      allBtn.textContent = 'Đã thêm ' + ok + ' giả thiết ✓'; allBtn.disabled = true;
      [...reviewArea.querySelectorAll('.btn-small')].forEach(b => { if (b.textContent.indexOf('Thêm giả thiết') !== -1) { b.textContent = 'Đã thêm ✓'; b.disabled = true; } });
    };
    reviewArea.appendChild(allBtn);
  }
}

function handleImageFile(file) {
  const status = document.getElementById('imgStatus');
  const reviewArea = document.getElementById('imgReviewArea');
  reviewArea.innerHTML = '';
  status.textContent = 'Đang xử lý ảnh…';
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      document.getElementById('imgPreview').src = e.target.result;
      document.getElementById('imgPreviewWrap').style.display = 'block';
      const maxW = 900;
      const scale = Math.min(1, maxW / img.width);
      const canvas = makeCanvasEl(Math.max(1, Math.round(img.width * scale)), Math.max(1, Math.round(img.height * scale)));
      const cctx = canvas.getContext('2d');
      cctx.fillStyle = '#fff'; cctx.fillRect(0, 0, canvas.width, canvas.height);
      cctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try {
        const templates = getImgTemplates();
        const lines = recognizeMultiLine(canvas, templates, makeCanvasEl).map(l => l.trim()).filter(Boolean);
        if (!lines.length) {
          status.textContent = 'Không tìm thấy chữ trong ảnh này. Hãy thử ảnh rõ nét hơn hoặc nhập trực tiếp.';
          return;
        }
        if (lines.length === 1 && !tryLineAsHypothesis(lines[0])) {
          document.getElementById('exprInput').value = lines[0];
          status.textContent = 'Đã nhận diện: "' + lines[0] + '" — vui lòng kiểm tra và sửa lại nếu cần trước khi bấm Giải.';
          document.querySelector('.tab[data-mode="text"]').click();
          return;
        }
        status.textContent = 'Đã nhận diện ' + lines.length + (lines.length > 1 ? ' dòng' : ' dòng') + ' — chọn cách dùng cho từng dòng bên dưới (luôn kiểm tra lại chữ nhận diện được):';
        renderImageLinesReview(lines);
      } catch (err) {
        status.textContent = 'Có lỗi khi nhận diện ảnh. Hãy thử nhập trực tiếp hoặc dán LaTeX.';
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ---------- context building + solve ----------
function buildContext() {
  const knownProb = new Map();
  state.hypotheses.forEach(h => knownProb.set(h.key, h.value));
  const independentGroups = state.independentGroups.map(g => new Set(g.names));
  const mutexPairs = new Set(state.mutexPairs.map(p => pairKey(p[0], p[1])));
  return { knownProb, independentGroups, mutexPairs, partition: state.partition };
}

function buildLatexSource(steps, queryLatex, finalResult) {
  const finalLine = `${queryLatex} = ${finalResult.numeric != null ? fmtNum(finalResult.numeric) : finalResult.latex}`;
  if (!steps.length) return finalLine;
  return '\\begin{gathered}\n' + steps.map(s => s.eq).join(' \\\\\n') + ' \\\\\n' + finalLine + '\n\\end{gathered}';
}
function copyLatexSolution(steps, queryLatex, finalResult, btn) {
  const tex = buildLatexSource(steps, queryLatex, finalResult);
  const done = () => { const old = btn.textContent; btn.textContent = 'Đã sao chép!'; setTimeout(() => { btn.textContent = old; }, 1500); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(tex).then(done).catch(() => { showFallbackCopy(tex); });
  } else { showFallbackCopy(tex); }
}
function showFallbackCopy(tex) {
  window.prompt('Sao chép mã LaTeX bên dưới (Ctrl+C):', tex);
}
function downloadLatexFile(steps, queryLatex, finalResult) {
  const tex = buildLatexSource(steps, queryLatex, finalResult);
  const blob = new Blob([tex], { type: 'text/x-tex;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = 'loi-giai.tex';
  link.href = url;
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function downloadResultsPng(el, filename) {
  html2canvas(el, { backgroundColor: '#1B2321', scale: 2 }).then(canvas => {
    const link = document.createElement('a');
    link.download = filename || 'loi-giai.png';
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  }).catch(() => { alert('Không tạo được ảnh để tải về.'); });
}

function runSolve() {
  const resultsBody = document.getElementById('resultsBody');
  resultsBody.innerHTML = '';
  let query;
  try {
    const text = getActiveInputText();
    if (!text.trim()) { resultsBody.innerHTML = '<p id="placeholderMsg">Hãy nhập một biểu thức trước.</p>'; return; }
    query = parseQuery(text);
  } catch (e) {
    resultsBody.innerHTML = `<p style="color:var(--danger)">Không đọc được biểu thức: ${e.message}</p>`;
    return;
  }
  const queryNode = flatten(query.arg);
  const ctx = buildContext();
  const { solve, steps, missing } = makeSolver();
  let finalResult;
  try {
    finalResult = solve(queryNode, ctx, colorOf);
  } catch (e) {
    resultsBody.innerHTML = `<p style="color:var(--danger)">Có lỗi khi giải biểu thức này: ${e.message}</p>`;
    return;
  }

  const stepsDiv = document.createElement('div'); stepsDiv.id = 'stepsArea';
  const stepsHeading = document.createElement('h2'); stepsHeading.textContent = 'Các bước giải'; stepsHeading.style.marginTop = '0';
  resultsBody.appendChild(stepsHeading);
  if (steps.length === 0) {
    const p = document.createElement('p'); p.className = 'hint';
    p.textContent = 'Biểu thức này trùng khớp trực tiếp với một giả thiết đã biết, không cần khai triển thêm.';
    stepsDiv.appendChild(p);
  }
  steps.forEach((s, i) => {
    const stepDiv = document.createElement('div'); stepDiv.className = 'step';
    const ruleDiv = document.createElement('div'); ruleDiv.className = 'step-rule';
    ruleDiv.innerHTML = `<span class="step-num">${i + 1}.</span>${s.rule}`;
    stepDiv.appendChild(ruleDiv);
    const eqDiv = document.createElement('div'); eqDiv.className = 'step-eq';
    renderKatexTo(eqDiv, s.eq, true);
    stepDiv.appendChild(eqDiv);
    stepsDiv.appendChild(stepDiv);
  });
  resultsBody.appendChild(stepsDiv);

  const queryLatex = toProbLatex(queryNode, colorOf);
  const finalDiv = document.createElement('div'); finalDiv.className = 'final-answer';
  const label = document.createElement('div'); label.className = 'label'; label.textContent = 'Kết quả';
  finalDiv.appendChild(label);
  const ansEl = document.createElement('div');
  renderKatexTo(ansEl, `${queryLatex} = ${finalResult.numeric != null ? fmtNum(finalResult.numeric) : finalResult.latex}`, true);
  finalDiv.appendChild(ansEl);
  if (finalResult.numeric == null && missing.size) {
    const note = document.createElement('div'); note.className = 'missing-note';
    note.textContent = 'Cần thêm giả thiết cho: ' + [...missing].join(', ');
    finalDiv.appendChild(note);
  }
  resultsBody.appendChild(finalDiv);

  const atomNames = [...collectAtoms(queryNode)];
  const actionsDiv = document.createElement('div'); actionsDiv.className = 'btn-row';
  const copyBtn = document.createElement('button'); copyBtn.className = 'btn'; copyBtn.textContent = 'Sao chép LaTeX lời giải';
  copyBtn.onclick = () => copyLatexSolution(steps, queryLatex, finalResult, copyBtn);
  const downloadTexBtn = document.createElement('button'); downloadTexBtn.className = 'btn'; downloadTexBtn.textContent = 'Tải mã LaTeX (.tex)';
  downloadTexBtn.onclick = () => downloadLatexFile(steps, queryLatex, finalResult);
  const downloadBtn = document.createElement('button'); downloadBtn.className = 'btn'; downloadBtn.textContent = 'Tải ảnh PNG';
  downloadBtn.onclick = () => downloadResultsPng(resultsBody);
  actionsDiv.appendChild(copyBtn); actionsDiv.appendChild(downloadTexBtn); actionsDiv.appendChild(downloadBtn);

  if (atomNames.length > 0) {
    const { names, regions } = computeMinterms(atomNames, ctx);
    const vennResult = renderVennDiagram(names, regions, colorOf);
    if (vennResult) {
      const vennHeading = document.createElement('h2'); vennHeading.textContent = 'Biểu đồ Venn';
      resultsBody.appendChild(vennHeading);
      if (vennResult.svg) {
        const svgWrap = document.createElement('div'); svgWrap.id = 'vennSvgContainer';
        svgWrap.innerHTML = vennResult.svg;
        resultsBody.appendChild(svgWrap);
      } else if (vennResult.isTable) {
        const tblWrap = document.createElement('div'); tblWrap.id = 'vennTableWrap';
        tblWrap.innerHTML = vennResult.html;
        resultsBody.appendChild(tblWrap);
        const note = document.createElement('p'); note.className = 'hint';
        note.textContent = `Từ 5 tập hợp trở lên không thể vẽ Venn diagram chính xác bằng đường cong lồi mà đủ mọi vùng giao, nên hiển thị dạng bảng liệt kê cả ${Math.pow(2, names.length)} vùng.`;
        resultsBody.appendChild(note);
      }
    }
  }
  resultsBody.appendChild(actionsDiv);
}
document.getElementById('solveBtn').onclick = runSolve;

// ---------- initial worked example ----------
(function init() {
  function hyp(exprStr, value) {
    const node = flatten(parseExpression(exprStr));
    return { node, value, key: canonicalKey(node) };
  }
  // A fuller 3-set example (not just 2) so it's obvious right away that the
  // tool isn't limited to two events.
  state.hypotheses.push(
    hyp('A', 0.3), hyp('B', 0.4), hyp('C', 0.5),
    hyp('A n B', 0.1), hyp('A n C', 0.15), hyp('B n C', 0.2),
    hyp('A n B n C', 0.05)
  );
  document.getElementById('exprInput').value = 'P(A U B U C)';
  renderHypothesesList();
})();
