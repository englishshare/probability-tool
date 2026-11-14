/* ============================================================
   VENN: region (minterm) computation, consistency warnings and SVG diagrams
   ============================================================ */

// ---------- VENN MINTERMS ----------
function collectAtoms(node, out) {
  out = out || new Set();
  if (!node) return out;
  if (node.type === 'ATOM') out.add(node.name);
  else if (node.type === 'COMPLEMENT') collectAtoms(node.arg, out);
  else if (node.type === 'UNION' || node.type === 'INTERSECT') node.args.forEach(a => collectAtoms(a, out));
  else if (node.type === 'COND') {
     collectAtoms(node.arg, out);
     collectAtoms(node.given, out);
  }
  return out;
}

// Probability of each of the 2^n regions of the given sets. The linear model
// (linear.js) is asked first -- it pins down every region the facts imply in
// any direction -- and whatever it cannot determine falls back to the
// rule-based solver. One solver (hence one cache) is shared across all
// regions instead of building a fresh one per region, which threw away
// every sub-result each region had in common with the others.
function computeMinterms(atomNames, ctx, model) {
  const names = [...atomNames];
  const n = names.length;
  const lin = model === undefined ? buildLinearModel(ctx, names) : model;
  const shared = makeSolver();
  const regions = [];
  for (let mask = 0; mask < (1 << n); mask++) {
    const args = names.map((name, idx) => {
      const atomNode = { type: 'ATOM', name };
      return ((mask >> idx) & 1) ? atomNode : { type: 'COMPLEMENT', arg: atomNode };
    });
    const node = n === 0 ? { type: 'UNIVERSE' } : flatten({ type: 'INTERSECT', args });
    const det = lin ? lin.valueOf(node) : null;
    regions.push({ mask, numeric: det ? det.value : shared.solve(node, ctx, null).numeric });
  }
  return { names, regions };
}

// Hypotheses can contradict each other (P(A∩B) larger than P(A), say) and
// the rule engine will still happily push numbers through; the telltale is
// a region of the Venn diagram coming out negative, or a result outside
// [0,1]. Better to say so than to hand back a confident-looking wrong answer.
function consistencyWarnings(names, regions, finalNumeric) {
  const warnings = [];
  const eps = 1e-9;
  const label = mask => names.map((nm, i) => ((mask >> i) & 1) ? nm : nm + "'").join(' ∩ ');
  for (const r of regions) {
    if (r.numeric == null) continue;
    if (r.numeric < -eps) warnings.push({ kind: 'negative', text: 'Vùng ' + label(r.mask) + ' ra xác suất âm (' + fmtNum(r.numeric) + ').' });
    else if (r.numeric > 1 + eps) warnings.push({ kind: 'over', text: 'Vùng ' + label(r.mask) + ' ra xác suất lớn hơn 1 (' + fmtNum(r.numeric) + ').' });
  }
  if (finalNumeric != null && (finalNumeric < -eps || finalNumeric > 1 + eps)) {
    warnings.push({ kind: 'result', text: 'Kết quả ' + fmtNum(finalNumeric) + ' nằm ngoài [0, 1].' });
  }
  const resolved = regions.every(r => r.numeric != null);
  if (resolved && regions.length) {
    const sum = regions.reduce((s, r) => s + r.numeric, 0);
    if (Math.abs(sum - 1) > 1e-6) warnings.push({ kind: 'sum', text: 'Tổng xác suất của mọi vùng là ' + fmtNum(sum) + ', không bằng 1.' });
  }
  return warnings;
}

/* ============================================================
   VENN DIAGRAM RENDERING (SVG). Circles for 2–3 sets, the
   empirically-validated 4-ellipse construction for 4 sets
   (parameters found by exhaustively sampling arrangements until
   all 16 regions were confirmed present with reasonable area —
   see build notes), and a plain region table for 5+ sets, since
   no arrangement of convex curves can show all 2^n regions once
   n ≥ 5.
   ============================================================ */
function fmtRegion(v) { return v == null ? '?' : (Math.round(v * 1e6) / 1e6).toString(); }
function regionVal(regions, pattern) {
  const mask = pattern.reduce((m, v, i) => m | (v ? (1 << i) : 0), 0);
  const r = regions.find(r => r.mask === mask);
  return r ? r.numeric : null;
}

function renderVenn1(names, regions, colorOf) {
  const val = a => fmtRegion(regionVal(regions, [a]));
  const c = colorOf(names[0]);
  return `<svg viewBox="0 0 360 300" xmlns="http://www.w3.org/2000/svg" font-family="Cambria, 'Palatino Linotype', 'Noto Serif', 'Times New Roman', serif">
    <rect x="10" y="10" width="340" height="280" rx="14" fill="none" stroke="var(--line-strong)" stroke-width="2"/>
    <circle cx="180" cy="150" r="105" fill="${c}" fill-opacity="0.3" stroke="${c}" stroke-width="2.5"/>
    <text x="46" y="40" font-size="14" fill="var(--text)">Ngoài ${names[0]}: ${val(false)}</text>
    <text x="180" y="155" font-size="19" fill="var(--text)" text-anchor="middle">${val(true)}</text>
    <text x="180" y="270" font-size="16" fill="${c}" text-anchor="middle">${names[0]}</text>
  </svg>`;
}

function renderVenn2(names, regions, colorOf) {
  const ca = colorOf(names[0]), cb = colorOf(names[1]);
  const val = (a, b) => fmtRegion(regionVal(regions, [a, b]));
  return `<svg viewBox="0 0 440 320" xmlns="http://www.w3.org/2000/svg" font-family="Cambria, 'Palatino Linotype', 'Noto Serif', 'Times New Roman', serif">
    <rect x="10" y="10" width="420" height="300" rx="14" fill="none" stroke="var(--line-strong)" stroke-width="2"/>
    <circle cx="175" cy="160" r="110" fill="${ca}" fill-opacity="0.32" stroke="${ca}" stroke-width="2.5"/>
    <circle cx="275" cy="160" r="110" fill="${cb}" fill-opacity="0.32" stroke="${cb}" stroke-width="2.5"/>
    <text x="55" y="40" font-size="14" fill="var(--text)">Ngoài ${names[0]}, ${names[1]}: ${val(false, false)}</text>
    <text x="118" y="165" font-size="19" fill="var(--text)" text-anchor="middle">${val(true, false)}</text>
    <text x="332" y="165" font-size="19" fill="var(--text)" text-anchor="middle">${val(false, true)}</text>
    <text x="225" y="165" font-size="19" fill="var(--text)" text-anchor="middle">${val(true, true)}</text>
    <text x="175" y="290" font-size="17" fill="${ca}" text-anchor="middle">${names[0]}</text>
    <text x="275" y="290" font-size="17" fill="${cb}" text-anchor="middle">${names[1]}</text>
  </svg>`;
}

function renderVenn3(names, regions, colorOf) {
  const [ca, cb, cc] = names.map(colorOf);
  const val = (a, b, c) => fmtRegion(regionVal(regions, [a, b, c]));
  return `<svg viewBox="0 0 460 400" xmlns="http://www.w3.org/2000/svg" font-family="Cambria, 'Palatino Linotype', 'Noto Serif', 'Times New Roman', serif">
    <rect x="10" y="10" width="440" height="380" rx="14" fill="none" stroke="var(--line-strong)" stroke-width="2"/>
    <circle cx="190" cy="170" r="115" fill="${ca}" fill-opacity="0.28" stroke="${ca}" stroke-width="2.5"/>
    <circle cx="290" cy="170" r="115" fill="${cb}" fill-opacity="0.28" stroke="${cb}" stroke-width="2.5"/>
    <circle cx="240" cy="260" r="115" fill="${cc}" fill-opacity="0.28" stroke="${cc}" stroke-width="2.5"/>
    <text x="55" y="40" font-size="13" fill="var(--text)">Ngoài tất cả: ${val(false, false, false)}</text>
    <text x="140" y="120" font-size="16" fill="var(--text)" text-anchor="middle">${val(true, false, false)}</text>
    <text x="340" y="120" font-size="16" fill="var(--text)" text-anchor="middle">${val(false, true, false)}</text>
    <text x="240" y="345" font-size="16" fill="var(--text)" text-anchor="middle">${val(false, false, true)}</text>
    <text x="240" y="150" font-size="16" fill="var(--text)" text-anchor="middle">${val(true, true, false)}</text>
    <text x="175" y="255" font-size="16" fill="var(--text)" text-anchor="middle">${val(true, false, true)}</text>
    <text x="305" y="255" font-size="16" fill="var(--text)" text-anchor="middle">${val(false, true, true)}</text>
    <text x="240" y="210" font-size="16" fill="var(--text)" text-anchor="middle">${val(true, true, true)}</text>
    <text x="150" y="70" font-size="16" fill="${ca}" text-anchor="middle">${names[0]}</text>
    <text x="330" y="70" font-size="16" fill="${cb}" text-anchor="middle">${names[1]}</text>
    <text x="240" y="385" font-size="16" fill="${cc}" text-anchor="middle">${names[2]}</text>
  </svg>`;
}

// Validated by exhaustive point-sampling search (see build notes): 4
// congruent ellipses (a=210,b=105), centers offset 60 from a common point
// perpendicular to each one's own major axis, rotated 0/45/90/135°. All 16
// combinations are confirmed present with workable area at these values.
const VENN4_A = 210, VENN4_B = 105, VENN4_D = 60, VENN4_ANGLES = [0, 45, 90, 135];
const VENN4_CENTROIDS = {
  0: [12.45, -5.15], 1: [135.51, 48.52], 2: [-45.06, 71.29], 3: [68.85, 99.12],
  4: [-82.17, -18.62], 5: [-111.38, 138.36], 6: [-82.48, 34.49], 7: [-19.48, 111.43],
  8: [61.36, -130.04], 9: [-126.78, 52.47], 10: [-176.53, -18.97], 11: [-118.22, 19.06],
  12: [-21.44, -118.74], 13: [-98.62, 71.13], 14: [-92.44, -65.06], 15: [-65.74, 27.28]
};
function renderVenn4(names, regions, colorOf) {
  const SHIFT = 340;
  const ellipses = VENN4_ANGLES.map(deg => {
    const th = deg * Math.PI / 180;
    return { cx: -VENN4_D * Math.sin(th), cy: VENN4_D * Math.cos(th), thetaDeg: deg };
  });
  const colors = names.map(colorOf);
  let svg = `<svg viewBox="0 0 ${SHIFT * 2} ${SHIFT * 2}" xmlns="http://www.w3.org/2000/svg" font-family="Cambria, 'Palatino Linotype', 'Noto Serif', 'Times New Roman', serif">`;
  svg += `<rect x="10" y="10" width="${SHIFT * 2 - 20}" height="${SHIFT * 2 - 20}" rx="16" fill="none" stroke="var(--line-strong)" stroke-width="2"/>`;
  ellipses.forEach((e, i) => {
    svg += `<ellipse cx="${e.cx + SHIFT}" cy="${e.cy + SHIFT}" rx="${VENN4_A}" ry="${VENN4_B}" transform="rotate(${e.thetaDeg} ${e.cx + SHIFT} ${e.cy + SHIFT})" fill="${colors[i]}" fill-opacity="0.25" stroke="${colors[i]}" stroke-width="2.5"/>`;
  });
  for (let mask = 0; mask < 16; mask++) {
    const v = fmtRegion((regions.find(r => r.mask === mask) || {}).numeric);
    if (mask === 0) { svg += `<text x="46" y="40" font-size="14" fill="var(--text)">Ngoài tất cả: ${v}</text>`; continue; }
    const [x, y] = VENN4_CENTROIDS[mask];
    svg += `<text x="${x + SHIFT}" y="${y + SHIFT}" font-size="14" fill="var(--text)" text-anchor="middle">${v}</text>`;
  }
  const tipExtra = 22;
  names.forEach((nm, i) => {
    const th = ellipses[i].thetaDeg * Math.PI / 180;
    const tx = ellipses[i].cx + (VENN4_A + tipExtra) * Math.cos(th);
    const ty = ellipses[i].cy + (VENN4_A + tipExtra) * Math.sin(th);
    svg += `<text x="${tx + SHIFT}" y="${ty + SHIFT}" font-size="20" fill="${colors[i]}" text-anchor="middle">${nm}</text>`;
  });
  svg += `</svg>`;
  return svg;
}

function renderVennTable(names, regions, colorOf) {
  let html = '<table><thead><tr>';
  names.forEach(nm => { html += `<th><span class="set-chip" style="background:${colorOf(nm)}22;color:${colorOf(nm)}">${nm}</span></th>`; });
  html += '<th>Xác suất</th></tr></thead><tbody>';
  regions.forEach(r => {
    html += '<tr>';
    names.forEach((nm, i) => { html += `<td>${((r.mask >> i) & 1) ? nm : nm + "'"}</td>`; });
    html += `<td>${fmtRegion(r.numeric)}</td></tr>`;
  });
  html += '</tbody></table>';
  return { html, isTable: true };
}

function renderVennDiagram(names, regions, colorOf) {
  if (names.length === 0) return null;
  if (names.length === 1) return { svg: renderVenn1(names, regions, colorOf) };
  if (names.length === 2) return { svg: renderVenn2(names, regions, colorOf) };
  if (names.length === 3) return { svg: renderVenn3(names, regions, colorOf) };
  if (names.length === 4) return { svg: renderVenn4(names, regions, colorOf) };
  return renderVennTable(names, regions, colorOf);
}

// ---- TikZ export ---------------------------------------------------------
// The same geometry as the SVG above (centres, radii, rotation angles and
// label positions), in TikZ: for people who typeset exams and reports in
// LaTeX and want the diagram as vector drawing code rather than a screenshot.
// SVG's y axis points down and TikZ's up, hence the flip; a rotation that is
// clockwise on screen is negative in TikZ for the same reason.
const VENN_TIKZ_LAYOUT = {
  1: { U: 70, W: 360, H: 300, frame: [10, 10, 340, 280], circles: [[180, 150, 105]], outside: [46, 40], values: { 1: [180, 155] }, names: [[180, 270]] },
  2: { U: 70, W: 440, H: 320, frame: [10, 10, 420, 300], circles: [[175, 160, 110], [275, 160, 110]], outside: [55, 40], values: { 1: [118, 165], 2: [332, 165], 3: [225, 165] }, names: [[175, 290], [275, 290]] },
  3: { U: 70, W: 460, H: 400, frame: [10, 10, 440, 380], circles: [[190, 170, 115], [290, 170, 115], [240, 260, 115]], outside: [55, 40],
    values: { 1: [140, 120], 2: [340, 120], 4: [240, 345], 3: [240, 150], 5: [175, 255], 6: [305, 255], 7: [240, 210] }, names: [[150, 70], [330, 70], [240, 385]] },
};

function renderVennTikz(names, regions, colorOf) {
  const n = names.length;
  if (n < 1 || n > 4) return null;
  const fmt = v => String(+v.toFixed(2));
  const val = mask => { const r = regions.find(x => x.mask === mask); return r && r.numeric != null ? fmtNum(r.numeric) : '\\textbf{?}'; };
  const hex = nm => colorOf(nm).replace('#', '').toUpperCase();
  const cname = i => 'venn' + 'ABCD'[i];
  const mathName = nm => '$' + nm.replace(/(\d+)$/, '_{$1}') + '$';
  const outsideLabel = '$\\overline{' + names.join(' \\cup ') + '}$';
  const out = [];
  out.push('% Biểu đồ Venn — cần \\usepackage{tikz}');
  out.push(n === 4 ? '\\begin{tikzpicture}[font=\\scriptsize]' : '\\begin{tikzpicture}[font=\\small]');
  names.forEach((nm, i) => out.push(`  \\definecolor{${cname(i)}}{HTML}{${hex(nm)}}`));

  if (n <= 3) {
    const L = VENN_TIKZ_LAYOUT[n];
    const P = (x, y) => `(${fmt(x / L.U)},${fmt((L.H - y) / L.U)})`;
    const [fx, fy, fw, fh] = L.frame;
    out.push(`  \\draw[rounded corners=6pt, thick, gray] ${P(fx, fy + fh)} rectangle ${P(fx + fw, fy)};`);
    L.circles.forEach(([cx, cy, r], i) => out.push(`  \\filldraw[fill=${cname(i)}, fill opacity=0.28, draw=${cname(i)}, very thick] ${P(cx, cy)} circle (${fmt(r / L.U)});`));
    out.push(`  \\node[anchor=west] at ${P(...L.outside)} {${outsideLabel} = ${val(0)}};`);
    Object.entries(L.values).forEach(([mask, [x, y]]) => out.push(`  \\node at ${P(x, y)} {${val(+mask)}};`));
    L.names.forEach(([x, y], i) => out.push(`  \\node[text=${cname(i)}] at ${P(x, y)} {${mathName(names[i])}};`));
  } else {
    const U = 75, S = 340, H = S * 2;
    const P = (x, y) => `(${fmt((x + S) / U)},${fmt((H - (y + S)) / U)})`;
    out.push(`  \\draw[rounded corners=6pt, thick, gray] ${P(-S + 10, S - 10)} rectangle ${P(S - 10, -S + 10)};`);
    VENN4_ANGLES.forEach((deg, i) => {
      const th = deg * Math.PI / 180;
      const cx = -VENN4_D * Math.sin(th), cy = VENN4_D * Math.cos(th);
      const c = P(cx, cy);
      out.push(`  \\filldraw[rotate around={${-deg}:${c}}, fill=${cname(i)}, fill opacity=0.25, draw=${cname(i)}, very thick] ${c} ellipse (${fmt(VENN4_A / U)} and ${fmt(VENN4_B / U)});`);
    });
    out.push(`  \\node[anchor=west] at ${P(-S + 46, -S + 40)} {${outsideLabel} = ${val(0)}};`);
    for (let mask = 1; mask < 16; mask++) { const [x, y] = VENN4_CENTROIDS[mask]; out.push(`  \\node at ${P(x, y)} {${val(mask)}};`); }
    VENN4_ANGLES.forEach((deg, i) => {
      const th = deg * Math.PI / 180;
      const tx = -VENN4_D * Math.sin(th) + (VENN4_A + 22) * Math.cos(th);
      const ty = VENN4_D * Math.cos(th) + (VENN4_A + 22) * Math.sin(th);
      out.push(`  \\node[text=${cname(i)}] at ${P(tx, ty)} {${mathName(names[i])}};`);
    });
  }
  out.push('\\end{tikzpicture}');
  return out.join('\n');
}

// the picture alone, as a compilable document (class `standalone` crops to it)
function renderVennTikzDocument(names, regions, colorOf) {
  const pic = renderVennTikz(names, regions, colorOf);
  if (!pic) return null;
  return ['% Biên dịch bằng pdfLaTeX. Dùng \\documentclass[tikz]{standalone} nên PDF chỉ chứa đúng hình.',
    '\\documentclass[tikz, border=6pt]{standalone}', '\\begin{document}', pic, '\\end{document}', ''].join('\n');
}
