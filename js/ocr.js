/* ============================================================
   IMAGE RECOGNITION: self-contained canvas template-matching for
   the notation alphabet. Runs entirely in the browser -- no
   external OCR service or model download, so it works inside the
   artifact's sandbox. Best suited to clean printed/typed text
   using the U / n convention; messy handwriting or dense LaTeX
   layouts (fractions, exponents) are out of scope for this
   approach, which is why the recognized text lands in the
   editable "Ký hiệu thường" field for the person to check rather
   than being solved automatically.
   ============================================================ */
const ALPHABET = [
  ...'ABCDEFGHIJKLMNOPQRSTVWXYZ'.split(''), // 'U' excluded: reserved for union
  ...'0123456789'.split(''),
  '(', ')', "'", ',', '|', '=', '.', 'U', 'n',
  // '\' (set difference) is deliberately left out of the image alphabet: it's
  // rare in practice -- "A \ B" is equally well written "A n B'", already
  // fully supported -- and an unusual stroke with little cross-font
  // reference ends up a tempting false match for the much more common,
  // structurally essential "(" and ")" that this syntax depends on
  // everywhere. It's still typeable directly in the text/LaTeX tabs.
];
// Math text (Word's equation editor, LaTeX) renders letters *italic* by
// convention, which none of these plain upright fonts look anything like --
// so templates are generated in italic fonts too, plus a couple of
// synthetic shear amounts on the upright fonts as extra in-between
// coverage, rather than betting on one specific italic font matching
// whatever the source document used closely enough on shape alone.
const UPRIGHT_FONTS = ['48px sans-serif', '48px serif', '48px monospace'];
const ITALIC_FONTS = ['italic 48px serif', 'italic 48px sans-serif'];
const TEMPLATE_SHEARS = [0, 0.14, 0.26];
const NORM_SIZE = 32;

function makeCanvasEl(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function renderTemplates(canvasFactory) {
  const SIZE = 96, BASE = 66;
  const templates = [];
  const work = canvasFactory(SIZE, SIZE);
  const wctx = work.getContext('2d');
  const variants = [];
  for (const f of UPRIGHT_FONTS) for (const s of TEMPLATE_SHEARS) variants.push({ font: f, shear: s });
  for (const f of ITALIC_FONTS) variants.push({ font: f, shear: 0 });
  // Typeset math draws union and intersection as the real symbols, not as the
  // letters U / n, so those glyphs get templates too -- each emitting the
  // plain-text operator this tool's syntax uses for it.
  const sources = ALPHABET.map(c => ({ ch: c, glyph: c })).concat([{ ch: 'U', glyph: '\u222A' }, { ch: 'n', glyph: '\u2229' }]);
  for (const { ch, glyph } of sources) {
    for (const v of variants) {
      wctx.setTransform(1, 0, 0, 1, 0, 0);
      wctx.fillStyle = '#fff'; wctx.fillRect(0, 0, SIZE, SIZE);
      wctx.fillStyle = '#000'; wctx.font = v.font; wctx.textBaseline = 'alphabetic';
      // right-leaning shear about the baseline, synthesizing an italic-ish
      // slant on top of the upright fonts for in-between coverage
      wctx.setTransform(1, 0, -v.shear, 1, v.shear * BASE, 0);
      wctx.fillText(glyph, 14, BASE);
      wctx.setTransform(1, 0, 0, 1, 0, 0);
      const bbox = inkBBox(wctx.getImageData(0, 0, SIZE, SIZE).data, SIZE, SIZE);
      if (!bbox) continue;
      const norm = canvasFactory(NORM_SIZE, NORM_SIZE);
      const nctx = norm.getContext('2d');
      nctx.fillStyle = '#fff'; nctx.fillRect(0, 0, NORM_SIZE, NORM_SIZE);
      drawCropScaled(nctx, work, bbox, NORM_SIZE);
      templates.push({ ch, bitmap: blurBitmap(toBinaryBitmap(nctx.getImageData(0, 0, NORM_SIZE, NORM_SIZE).data, NORM_SIZE, NORM_SIZE), NORM_SIZE), aspect: bbox.w / bbox.h });
    }
  }
  return templates;
}

function inkBBox(data, w, h, threshold) {
  threshold = threshold == null ? 128 : threshold;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (gray < threshold) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function drawCropScaled(destCtx, srcCanvas, bbox, size) {
  const pad = Math.round(size * 0.12);
  const avail = size - 2 * pad;
  const scale = Math.min(avail / bbox.w, avail / bbox.h);
  const dw = bbox.w * scale, dh = bbox.h * scale;
  const dx = (size - dw) / 2, dy = (size - dh) / 2;
  destCtx.drawImage(srcCanvas, bbox.x, bbox.y, bbox.w, bbox.h, dx, dy, dw, dh);
}

function toBinaryBitmap(data, w, h, threshold) {
  threshold = threshold == null ? 128 : threshold;
  const out = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
    out[p] = gray < threshold ? 1 : 0;
  }
  return out;
}

function blurBitmap(bitmap, size, passes) {
  passes = passes || 2;
  let src = bitmap;
  for (let p = 0; p < passes; p++) {
    const dst = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let sum = 0, cnt = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < size && ny >= 0 && ny < size) { sum += src[ny * size + nx]; cnt++; }
          }
        }
        dst[y * size + x] = sum / cnt;
      }
    }
    src = dst;
  }
  return src;
}

function blurredDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; sum += d * d; }
  return sum / a.length;
}

function detectPolarity(data, w, h) {
  let darkCount = 0;
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (gray < 128) darkCount++;
  }
  return darkCount > (w * h) / 2 ? 'inverted' : 'normal';
}

// Shared by segmentRows/labelComponents: read pixel data once and correct
// polarity once, returning a plain isInk(x,y) tester over the whole canvas.
function buildInkTester(canvas) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d');
  let data = ctx.getImageData(0, 0, w, h).data;
  if (detectPolarity(data, w, h) === 'inverted') {
    const inv = ctx.createImageData(w, h);
    for (let i = 0; i < data.length; i += 4) {
      const g = 255 - (data[i] + data[i + 1] + data[i + 2]) / 3;
      inv.data[i] = inv.data[i + 1] = inv.data[i + 2] = g; inv.data[i + 3] = 255;
    }
    data = inv.data;
  }
  return (x, y) => {
    const i = (y * w + x) * 4;
    return (data[i] + data[i + 1] + data[i + 2]) / 3 < 128;
  };
}

// A photo or screenshot can carry several stacked lines (e.g. several
// "P(X) = value" facts at once). A row is background exactly at the gaps
// *between* lines -- within one line, some character reaches almost every
// row of that line's own height, so this scans horizontal bands first, and
// only groups ink into characters (labelComponents, below) within each band
// separately, rather than treating the whole image as one line.
function rawRowBands(canvas, isInk, rangeTop, rangeBottom) {
  const w = canvas.width;
  const top0 = rangeTop == null ? 0 : rangeTop;
  const bottom0 = rangeBottom == null ? canvas.height - 1 : rangeBottom;
  const rowHasInk = new Array(bottom0 - top0 + 1).fill(false);
  for (let y = top0; y <= bottom0; y++) {
    for (let x = 0; x < w; x++) if (isInk(x, y)) { rowHasInk[y - top0] = true; break; }
  }
  const bands = [];
  let runStart = -1, gapLen = 0;
  const minGapRows = 2;
  const n = bottom0 - top0 + 1;
  for (let k = 0; k <= n; k++) {
    const ink = k < n && rowHasInk[k];
    if (ink) { if (runStart === -1) runStart = k; gapLen = 0; }
    else {
      gapLen++;
      if (runStart !== -1 && gapLen >= minGapRows) { bands.push({ top: runStart + top0, bottom: k - gapLen + top0 }); runStart = -1; }
    }
  }
  if (runStart !== -1) bands.push({ top: runStart + top0, bottom: n - 1 + top0 });
  return bands;
}

// A row-band that's short compared to the rest of the line and sits close
// above a taller one is treated as a diacritic (an overline over one of the
// letters below, from \overline{X} / a math editor's X-with-a-bar) and
// folded into that taller band, rather than discarded as noise -- which is
// what a bare height filter would otherwise do to it, silently dropping the
// bar and any complement it was marking. Two genuinely separate lines don't
// get caught by this: both are normal letter height, so neither looks
// "short" enough to be mistaken for a diacritic in the first place.
function mergeDiacriticBands(bands) {
  if (bands.length < 2) return bands;
  const heights = bands.map(b => b.bottom - b.top + 1);
  const maxH = Math.max(...heights);
  const sorted = bands.slice().sort((a, b) => a.top - b.top);
  const result = [];
  let i = 0;
  while (i < sorted.length) {
    const cur = sorted[i];
    const h = cur.bottom - cur.top + 1;
    const isShort = h < maxH * 0.4;
    const next = sorted[i + 1];
    if (isShort && next && (next.top - cur.bottom - 1) <= maxH * 1.2) {
      result.push({ top: cur.top, bottom: next.bottom });
      i += 2;
      continue;
    }
    result.push({ top: cur.top, bottom: cur.bottom });
    i++;
  }
  return result;
}

function segmentRows(canvas, isInk, rangeTop, rangeBottom) {
  const merged = mergeDiacriticBands(rawRowBands(canvas, isInk, rangeTop, rangeBottom));
  const heights = merged.map(b => b.bottom - b.top + 1);
  const maxH = Math.max(0, ...heights);
  return merged.filter(b => (b.bottom - b.top + 1) >= Math.max(3, maxH * 0.15));
}

// A tall band can be several text lines that happened to share one uniform
// local background at the coarse, whole-image polarity pass (see
// buildLocalInkTester above) -- so each band gets one attempt at splitting
// further using *its own* local polarity before settling on it as one line.
function refineRowBands(canvas, rows) {
  const refined = [];
  for (const r of rows) {
    const localIsInk = buildLocalInkTester(canvas, r.top, r.bottom);
    const sub = segmentRows(canvas, localIsInk, r.top, r.bottom);
    if (sub.length > 1) refined.push(...sub);
    else refined.push(r);
  }
  return refined;
}

// A screenshot can mix a dark page background with a lighter card (or the
// opposite) in the same shot, so one global light/dark call can be right
// for finding *where* the lines are and still wrong for what counts as ink
// *inside* one of them (a whole card can flip to reading as "ink" against
// very different surroundings, without the text inside it being what got
// picked out). Once a line's row band is known, its own polarity is
// re-derived from just those rows, full width, rather than reusing the
// whole-image decision.
// Two notions of "ink" for one line, both decided from just that line's rows.
// STRONG ink is clearly dark (or, on a dark background, clearly light) -- the
// body of each stroke. WEAK ink also takes in the anti-aliased fringe and the
// hairline strokes of high-contrast serif faces (the thin diagonal of a "2",
// the join in a "3"), which at screen resolution come out lighter than the
// strong cut-off and would otherwise snap one glyph into disconnected pieces.
// Where the cut-off for "weak" sits depends on how far the background is from
// the strong threshold, so it works for white, grey and dark pages alike.
function buildLocalInk(canvas, top, bottom) {
  const w = canvas.width;
  const h = bottom - top + 1;
  const data = canvas.getContext('2d').getImageData(0, top, w, h).data;
  const inverted = detectPolarity(data, w, h) === 'inverted';
  const hist = new Uint32Array(256);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    hist[Math.round((data[i] + data[i + 1] + data[i + 2]) / 3)]++;
  }
  let bg = inverted ? 0 : 255, most = -1;
  for (let g = 0; g < 256; g++) {
    if ((inverted ? g < 128 : g >= 128) && hist[g] > most) { most = hist[g]; bg = g; }
  }
  const weakT = inverted ? 128 - 0.6 * (128 - bg) : 128 + 0.6 * (bg - 128);
  const grayAt = (x, y) => {
    const ly = y - top;
    if (ly < 0 || ly >= h || x < 0 || x >= w) return null;
    const i = (ly * w + x) * 4;
    return (data[i] + data[i + 1] + data[i + 2]) / 3;
  };
  return {
    strong: (x, y) => { const g = grayAt(x, y); return g !== null && (inverted ? g >= 128 : g < 128); },
    weak: (x, y) => { const g = grayAt(x, y); return g !== null && (inverted ? g >= weakT : g < weakT); },
  };
}
function buildLocalInkTester(canvas, top, bottom) { return buildLocalInk(canvas, top, bottom).strong; }

// Math text is conventionally italic, and a slant makes column-projection
// segmentation (find x-gaps, cut there) unreliable: two neighbouring
// slanted letters routinely share x-columns even when their ink never
// touches, which either fuses them into one blob or misplaces the cut
// between them. Grouping actual 8-connected ink components sidesteps that,
// since it only ever groups pixels that are really touching.
function labelComponents(isInk, w, top, bottom) {
  const h = bottom - top + 1;
  const labels = new Int32Array(w * h);
  const comps = [];
  let nextId = 1;
  const stack = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (labels[y * w + x] !== 0 || !isInk(x, y + top)) continue;
      const id = nextId++;
      const comp = { id, minX: x, maxX: x, minY: y, maxY: y, area: 0 };
      labels[y * w + x] = id;
      stack.push(x, y);
      while (stack.length) {
        const cy = stack.pop(), cx = stack.pop();
        comp.area++;
        if (cx < comp.minX) comp.minX = cx; if (cx > comp.maxX) comp.maxX = cx;
        if (cy < comp.minY) comp.minY = cy; if (cy > comp.maxY) comp.maxY = cy;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            const idx = ny * w + nx;
            if (labels[idx] !== 0 || !isInk(nx, ny + top)) continue;
            labels[idx] = id;
            stack.push(nx, ny);
          }
        }
      }
      comps.push(comp);
    }
  }
  return { labels, comps, w, h, top };
}

function medianOf(arr) {
  const a = arr.slice().sort((x, y) => x - y);
  return a.length ? a[Math.floor(a.length / 2)] : 0;
}

function makeGlyphGroup(list) {
  const g = {
    ids: new Set(list.map(c => c.id)),
    minX: Math.min(...list.map(c => c.minX)), maxX: Math.max(...list.map(c => c.maxX)),
    minY: Math.min(...list.map(c => c.minY)), maxY: Math.max(...list.map(c => c.maxY)),
    prefix: '', suffix: '',
  };
  g.cx = (g.minX + g.maxX) / 2;
  return g;
}

// Turns raw ink components into the glyphs to actually recognize: strips
// out overline bars (folding what they mark as complemented into the
// letter or letter-group beneath them, so "ABC'D"/"(AB)'CD" comes out of
// this step already, not just a flat run of base characters) and re-pairs
// an "=" sign's two strokes, which briefly look exactly like a one-letter
// overline+body pair from directly above them and would otherwise be
// mis-split the same way.
function buildGlyphGroups(comps) {
  comps = comps.filter(c => c.area >= 2);
  if (!comps.length) return [];
  const H = c => c.maxY - c.minY + 1, W = c => c.maxX - c.minX + 1;
  const maxH = Math.max(...comps.map(H));
  const refH = medianOf(comps.filter(c => H(c) >= maxH * 0.5).map(H)) || maxH;
  const isFlat = c => H(c) <= refH * 0.32 && W(c) >= H(c) * 1.6;
  const isTall = c => H(c) >= refH * 0.45;
  const xOverlap = (a, b) => Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) + 1;
  const cxOf = c => (c.minX + c.maxX) / 2;

  const bars = [], barIds = new Set();
  for (const f of comps) {
    if (!isFlat(f)) continue;
    const below = comps.filter(c => c !== f && cxOf(c) >= f.minX && cxOf(c) <= f.maxX
      && c.minY >= f.maxY - refH * 0.15 && c.minY - f.maxY <= refH);
    if (below.some(isTall)) { bars.push(f); barIds.add(f.id); }
  }

  const rest = comps.filter(c => !barIds.has(c.id));

  // Fine serif faces draw the thin join of a "2", "3" or "5" so lightly that at
  // screen size it drops out and the heavy base comes loose as a flat sliver.
  // A flat piece sitting in the lower part of a tall component, inside its
  // horizontal span and not far below it, is that base: re-attach it. (An "="
  // never qualifies -- it sits beside its neighbours, not under one -- and an
  // overline sits above, which was already claimed as a bar.)
  const extras = new Map(), attached = new Set(), repaired = new Set();
  for (const f of rest) {
    if (!isFlat(f)) continue;
    const host = rest.find(h => h !== f && isTall(h) && !attached.has(h.id)
      && xOverlap(f, h) >= 0.7 * W(f) && W(f) >= 0.35 * W(h)
      && f.minY >= h.minY + 0.5 * H(h) && f.minY - h.maxY <= 0.6 * H(h));
    if (host) { attached.add(f.id); (extras.get(host.id) || extras.set(host.id, []).get(host.id)).push(f); repaired.add(host.id); }
  }

  // Slashed or dotted zeros (code and monospace faces) leave a mark sitting
  // in the middle of the ring. A small component centred well inside another
  // component's box is part of that glyph, not a glyph of its own -- unlike a
  // prime or a period, which sit at the edge or beside, never in the middle.
  for (const f of rest) {
    if (attached.has(f.id) || H(f) > 0.5 * refH) continue;
    const host = rest.find(h => h !== f && !attached.has(h.id) && H(h) >= 0.6 * refH && W(h) >= 2 * W(f)
      && f.minX >= h.minX && f.maxX <= h.maxX && f.minY >= h.minY && f.maxY <= h.maxY
      && Math.abs(cxOf(f) - cxOf(h)) <= 0.25 * W(h) && Math.abs((f.minY + f.maxY) / 2 - (h.minY + h.maxY) / 2) <= 0.25 * H(h));
    if (host) { attached.add(f.id); (extras.get(host.id) || extras.set(host.id, []).get(host.id)).push(f); }
  }

  const used = new Set();
  const groups = [];
  for (const a of rest) {
    if (used.has(a.id) || attached.has(a.id)) continue;
    used.add(a.id);
    if (extras.has(a.id)) {
      const g = makeGlyphGroup([a, ...extras.get(a.id)]);
      g.repair = repaired.has(a.id);
      groups.push(g);
      continue;
    }
    if (isFlat(a)) {
      let partner = null;
      for (const b of rest) {
        if (b === a || used.has(b.id) || attached.has(b.id) || !isFlat(b)) continue;
        const gap = Math.max(a.minY, b.minY) - Math.min(a.maxY, b.maxY) - 1;
        if (xOverlap(a, b) >= 0.6 * Math.min(W(a), W(b)) && gap <= refH * 0.6
          && Math.abs(W(a) - W(b)) <= 0.5 * Math.max(W(a), W(b))) { partner = b; break; }
      }
      if (partner) { used.add(partner.id); groups.push(makeGlyphGroup([a, partner])); continue; }
    }
    groups.push(makeGlyphGroup([a]));
  }
  groups.sort((p, q) => p.cx - q.cx);

  for (const f of bars) {
    // A letter counts as "under the bar" only once the bar actually covers
    // most of that letter's own width -- not just whenever the letter's
    // center point happens to fall somewhere inside the bar's span. With
    // the weaker center-point test, a bar drawn only a little wider than
    // its one intended letter (common once real rendering/kerning varies,
    // not the clean fixed spacing of a synthetic test) could additionally
    // catch a neighboring short or narrow letter whose center still landed
    // inside that extra width, wrapping the whole run in "(...)'" instead
    // of marking just the one letter it was actually drawn over.
    const covered = groups.filter(g => {
      const overlap = Math.min(f.maxX, g.maxX) - Math.max(f.minX, g.minX) + 1;
      const gw = g.maxX - g.minX + 1;
      return overlap / gw >= 0.5 && g.minY >= f.maxY - refH * 0.15 && g.minY - f.maxY <= refH;
    });
    if (!covered.length) continue;
    if (covered.length === 1) covered[0].suffix += "'";
    else { covered[0].prefix = '(' + covered[0].prefix; covered[covered.length - 1].suffix += ")'"; }
  }
  return groups;
}

// Pixels of one glyph. A glyph that had a detached piece re-attached also
// regrows, through weak (faint) ink inside its own box, the hairline stroke that
// joined the pieces -- otherwise it would be matched with a gap where the
// stroke should be. Other glyphs use their strong pixels only.
function glyphMembers(info, group, weak) {
  const members = new Set();
  const bw = group.maxX - group.minX + 1, bh = group.maxY - group.minY + 1;
  const inBox = (x, y) => x >= group.minX && x <= group.maxX && y >= group.minY && y <= group.maxY;
  const stack = [];
  for (let y = group.minY; y <= group.maxY; y++) {
    for (let x = group.minX; x <= group.maxX; x++) {
      if (group.ids.has(info.labels[y * info.w + x])) { members.add(y * info.w + x); if (group.repair && weak) stack.push(x, y); }
    }
  }
  if (group.repair && weak) {
    while (stack.length) {
      const cy = stack.pop(), cx = stack.pop();
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx, ny = cy + dy;
          if (!inBox(nx, ny)) continue;
          const idx = ny * info.w + nx;
          if (members.has(idx) || info.labels[idx] !== 0 || !weak(nx, ny + info.top)) continue;
          members.add(idx);
          stack.push(nx, ny);
        }
      }
    }
  }
  return { members, bw, bh };
}

function glyphBitmap(info, group, canvasFactory, weak) {
  const { members, bw, bh } = glyphMembers(info, group, weak);
  const tmp = canvasFactory(bw, bh);
  const tctx = tmp.getContext('2d');
  const img = tctx.createImageData(bw, bh);
  for (let i = 0; i < img.data.length; i += 4) { img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = 255; }
  for (let y = group.minY; y <= group.maxY; y++) {
    for (let x = group.minX; x <= group.maxX; x++) {
      if (members.has(y * info.w + x)) {
        const j = ((y - group.minY) * bw + (x - group.minX)) * 4;
        img.data[j] = img.data[j + 1] = img.data[j + 2] = 0;
      }
    }
  }
  tctx.putImageData(img, 0, 0);
  const norm = canvasFactory(NORM_SIZE, NORM_SIZE);
  const nctx = norm.getContext('2d');
  nctx.fillStyle = '#fff'; nctx.fillRect(0, 0, NORM_SIZE, NORM_SIZE);
  drawCropScaled(nctx, tmp, { x: 0, y: 0, w: bw, h: bh }, NORM_SIZE);
  return blurBitmap(toBinaryBitmap(nctx.getImageData(0, 0, NORM_SIZE, NORM_SIZE).data, NORM_SIZE, NORM_SIZE), NORM_SIZE);
}

// Scores one glyph against every template and keeps the best (lowest)
// score per character, so a caller can pick the winner either over the
// whole alphabet or over just the characters that make sense at that spot.
function rankGlyph(bitmap, group, templates) {
  // Squeezing every glyph into the same 32x32 box for shape comparison
  // throws away how wide or tall it started out -- which is exactly the
  // cue that keeps a flat, wide "=" from an unrelated font rendering
  // closer to a thin, tall "|" than to any real "=" template once blurred.
  // Restoring that as a mild penalty (log-scaled, since aspect ratios are
  // multiplicative) fixes that specific confusion without overriding the
  // shape match for glyphs of similar proportions (letters, digits...). A
  // handful of pixels (a period, a stray mark) makes the ratio itself noisy
  // -- one pixel either way swings it a lot -- so it's faded out for very
  // small glyphs and only applies at full strength once there's enough area
  // to trust the measurement.
  const gw = group.maxX - group.minX + 1, gh = group.maxY - group.minY + 1;
  const logAspect = Math.log(gw / Math.max(1, gh));
  const sizeFactor = Math.min(1, (gw * gh) / 50);
  const best = new Map();
  for (const t of templates) {
    const s = blurredDistance(bitmap, t.bitmap) + 0.03 * sizeFactor * Math.abs(Math.log(t.aspect) - logAspect);
    if (!best.has(t.ch) || s < best.get(t.ch)) best.set(t.ch, s);
  }
  return best;
}

function pickBest(rank, allowed) {
  let bestCh = '', bestScore = Infinity;
  for (const [ch, s] of rank) {
    if (allowed && !allowed(ch)) continue;
    if (s < bestScore) { bestScore = s; bestCh = ch; }
  }
  return bestCh;
}

// 'O' and '0' are visually near-identical in most fonts; in this tool's
// syntax a capital O sitting next to a digit or decimal point is virtually
// always a misread zero (a set literally named "O" next to raw digits like
// that essentially never comes up), so this nudges just those cases back
// to '0' rather than leaving a number like "0.O5" for the person to spot.
function disambiguateDigits(text) {
  const isDigitCtx = c => !!c && /[0-9.]/.test(c);
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    out += (ch === 'O' && (isDigitCtx(text[i - 1]) || isDigitCtx(text[i + 1]))) ? '0' : ch;
  }
  return out;
}

const VALUE_CHARS = new Set('0123456789.'.split(''));

// Per-row ink extent of a glyph: for every row it covers, the leftmost and
// rightmost ink column and the ink centroid.
function glyphRowProfile(info, group) {
  const rows = [];
  for (let y = group.minY; y <= group.maxY; y++) {
    let lo = Infinity, hi = -Infinity, sum = 0, n = 0;
    for (let x = group.minX; x <= group.maxX; x++) {
      if (group.ids.has(info.labels[y * info.w + x])) { if (x < lo) lo = x; if (x > hi) hi = x; sum += x; n++; }
    }
    if (n) rows.push({ lo, hi, cx: sum / n });
  }
  return rows;
}
const meanOf = a => a.reduce((p, q) => p + q, 0) / (a.length || 1);

// Signed bulge of a thin vertical glyph, as a fraction of its height: how far
// the middle third sits from the straight line through its ends. Any uniform
// slant cancels out, so a slanted bar scores ~0 while "(" bulges left (< 0) and
// ")" right (> 0). Squeezed into the shared 32x32 box a shallow thin arc looks
// almost exactly like "|", which is why the shape match alone cannot be trusted
// to tell them apart; this can.
function glyphCurvature(rows) {
  if (rows.length < 9) return 0;
  const t = Math.floor(rows.length / 3);
  const top = meanOf(rows.slice(0, t).map(r => r.cx)), bottom = meanOf(rows.slice(-t).map(r => r.cx));
  const mid = meanOf(rows.slice(t, rows.length - t).map(r => r.cx));
  return (mid - (top + bottom) / 2) / rows.length;
}

// Roughness of the left edge over the central rows (RMS distance from the
// best straight line, relative to glyph width). A "B" has a straight stem on
// its left, upright or slanted; an "8" curves in at the waist. They are the
// classic confusable pair in italic math type.
function leftEdgeRoughness(rows, width) {
  const a = rows.slice(Math.floor(rows.length * 0.15), Math.ceil(rows.length * 0.85));
  if (a.length < 6 || !width) return 0;
  const n = a.length, ys = a.map((_, i) => i), xs = a.map(r => r.lo);
  const my = meanOf(ys), mx = meanOf(xs);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (ys[i] - my) * (xs[i] - mx); den += (ys[i] - my) * (ys[i] - my); }
  const slope = den ? num / den : 0;
  const rms = Math.sqrt(meanOf(xs.map((x, i) => { const r = x - (mx + slope * (ys[i] - my)); return r * r; })));
  return rms / width;
}

// ---- touching glyphs ------------------------------------------------------
// Tight serif and italic type often makes neighbouring letters touch, and
// touching ink is a single component. A group much wider than the typical
// glyph on its line is a candidate: cut it at the thinnest column near its
// middle, and keep the cut only if the two halves are each recognized
// clearly better than the unsplit blob was (a genuine "W" or "M" is wide too,
// but matches its own template well and so is left alone).
function bestScoreOf(rank) { let b = Infinity; for (const v of rank.values()) if (v < b) b = v; return b; }

function splitTouching(info, groups, ink, canvasFactory, templates) {
  const tallest = () => Math.max(...groups.map(g => g.maxY - g.minY + 1));
  const typicalWidth = () => {
    const maxH = tallest();
    return medianOf(groups.filter(g => {
      const h = g.maxY - g.minY + 1, w = g.maxX - g.minX + 1;
      return h >= 0.6 * maxH && w / h >= 0.4 && w / h <= 1.3;
    }).map(g => g.maxX - g.minX + 1));
  };
  const scoreOf = g => bestScoreOf(rankGlyph(glyphBitmap(info, g, canvasFactory, ink.weak), g, templates));
  const boxOf = (id, region) => {
    const c = { id, minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, area: 0 };
    for (let y = region.minY; y <= region.maxY; y++) for (let x = region.minX; x <= region.maxX; x++) {
      if (info.labels[y * info.w + x] === id) { c.area++; if (x < c.minX) c.minX = x; if (x > c.maxX) c.maxX = x; if (y < c.minY) c.minY = y; if (y > c.maxY) c.maxY = y; }
    }
    return c;
  };
  let nextId = 1 + Math.max(0, ...info.comps.map(c => c.id));
  for (let pass = 0; pass < 8; pass++) {
    const medW = typicalWidth(), maxH = tallest();
    if (!medW) break;
    let did = false;
    for (let gi = 0; gi < groups.length && !did; gi++) {
      const g = groups[gi];
      const w = g.maxX - g.minX + 1, h = g.maxY - g.minY + 1;
      // Two letters side by side are about as wide as they are tall or wider;
      // a single capital (even "A", "D", "M") stays under ~1.3x its height.
      // Without this gate, an ordinary wide letter could be cut in half.
      if (g.ids.size !== 1 || g.repair || w < 1.45 * medW || w / h < 1.5 || h < 0.55 * maxH) continue;
      const [origId] = g.ids;
      const colInk = [];
      for (let x = g.minX; x <= g.maxX; x++) {
        let n = 0;
        for (let y = g.minY; y <= g.maxY; y++) if (info.labels[y * info.w + x] === origId) n++;
        colInk.push(n);
      }
      const lo = Math.floor(w * 0.3), hi = Math.ceil(w * 0.7), mid = w / 2;
      let cut = -1;
      for (let i = lo; i <= hi; i++) if (cut < 0 || colInk[i] < colInk[cut] || (colInk[i] === colInk[cut] && Math.abs(i - mid) < Math.abs(cut - mid))) cut = i;
      if (cut < 0 || colInk[cut] > 0.6 * Math.max(...colInk)) continue;
      const cutX = g.minX + cut;
      const moved = [];
      const rid = nextId++;
      for (let y = g.minY; y <= g.maxY; y++) for (let x = cutX + 1; x <= g.maxX; x++) {
        const idx = y * info.w + x;
        if (info.labels[idx] === origId) { info.labels[idx] = rid; moved.push(idx); }
      }
      const left = makeGlyphGroup([boxOf(origId, g)]), right = makeGlyphGroup([boxOf(rid, g)]);
      if (!moved.length || !isFinite(left.minX) || !isFinite(right.minX)) { moved.forEach(i => { info.labels[i] = origId; }); continue; }
      const whole = scoreOf(g), sl = scoreOf(left), sr = scoreOf(right);
      if (whole > 0.012 && (sl + sr) / 2 < whole * 0.7) {
        if (g.suffix.includes("'") && !g.prefix) { left.prefix = '('; right.suffix = ")'"; } else { left.prefix = g.prefix; right.suffix = g.suffix; }
        groups.splice(gi, 1, left, right);
        did = true;
      } else {
        moved.forEach(i => { info.labels[i] = origId; });
      }
    }
    if (!did) break;
  }
  groups.sort((p, q) => p.cx - q.cx);
  return groups;
}

const SET_LETTER = ch => /^[A-Z]$/.test(ch) && ch !== 'U';

function recognizeOneBand(canvas, top, bottom, templates, canvasFactory) {
  const ink = buildLocalInk(canvas, top, bottom);
  const info = labelComponents(ink.strong, canvas.width, top, bottom);
  const groups = splitTouching(info, buildGlyphGroups(info.comps), ink, canvasFactory, templates);
  const ranks = groups.map(g => rankGlyph(glyphBitmap(info, g, canvasFactory, ink.weak), g, templates));
  const chars = ranks.map(r => pickBest(r));
  const lastEq = chars.lastIndexOf('=');
  const exprEnd = lastEq === -1 ? chars.length : lastEq;

  // Reference geometry from the letters on this line.
  const letterIdx = chars.map((c, i) => (SET_LETTER(c) ? i : -1)).filter(i => i >= 0);
  const capTop = medianOf(letterIdx.map(i => groups[i].minY)), capBottom = medianOf(letterIdx.map(i => groups[i].maxY));
  const capH = letterIdx.length ? capBottom - capTop + 1 : 0;

  // Within the expression itself (before the last "="):
  for (let i = 0; i < exprEnd; i++) {
    const g = groups[i];
    const rows = glyphRowProfile(info, g);
    // "(" and ")" differ from "|" by a gentle bulge; the match score alone
    // cannot see it (see glyphCurvature), so decide by the bulge itself.
    if (chars[i] === '|' || chars[i] === '(' || chars[i] === ')') {
      const k = glyphCurvature(rows);
      if (Math.abs(k) >= 0.04) chars[i] = k < 0 ? '(' : ')';
    }
    // An apostrophe and a comma are the same little wedge; only where it sits
    // tells them apart -- up beside the letter's top, or down on the baseline.
    if ((chars[i] === "'" || chars[i] === ',') && capH) {
      const cy = (g.minY + g.maxY) / 2;
      chars[i] = cy < (capTop + capBottom) / 2 ? "'" : ',';
    }
    // In sans-serif type "|" and a capital "I" are the same bar; the bar used
    // for a condition runs from above the capitals to below the baseline, a
    // capital "I" only as tall as its neighbours.
    if ((chars[i] === 'I' || chars[i] === '|') && capH && (g.maxY - g.minY + 1) >= 1.12 * capH) chars[i] = '|';
    // A digit is only meaningful in a set name right after its letter ("B1",
    // "B12"). Anywhere else in an expression it is a misread letter, so take
    // the best letter instead; and an "8" that has a straight left stem is
    // really a "B", which the two glyphs' similar outlines make easy to miss.
    if (/[0-9]/.test(chars[i])) {
      const afterName = i > 0 && /[A-Z0-9]/.test(chars[i - 1]);
      if (!afterName) chars[i] = pickBest(ranks[i], SET_LETTER) || chars[i];
      else if (chars[i] === '8' && leftEdgeRoughness(rows, g.maxX - g.minX + 1) < 0.045) chars[i] = 'B';
    }
  }
  // What follows the last "=" is a number, so only digits and a decimal
  // point are plausible there -- a letter in that spot ("2" read as "D",
  // a "0" as "Q") is a misread by construction, and re-picking among just
  // the numeric glyphs repairs it using the shape evidence already
  // computed rather than leaving the person to spot it.
  if (lastEq !== -1) {
    // "," is allowed here too: Vietnamese writes decimals with a comma ("0,375").
    for (let i = lastEq + 1; i < chars.length; i++) {
      const c = pickBest(ranks[i], ch => VALUE_CHARS.has(ch) || ch === ',');
      chars[i] = c === ',' ? '.' : c;
    }
  }
  let out = '';
  groups.forEach((g, i) => { out += g.prefix + chars[i] + g.suffix; });
  return disambiguateDigits(out);
}

function recognizeCanvas(canvas, templates, canvasFactory) {
  const isInk = buildInkTester(canvas);
  const rows = segmentRows(canvas, isInk);
  if (!rows.length) return '';
  const top = Math.min(...rows.map(r => r.top)), bottom = Math.max(...rows.map(r => r.bottom));
  return recognizeOneBand(canvas, top, bottom, templates, canvasFactory);
}

// Multi-line entry point: one recognized string per detected line, top to
// bottom, together with the pixel rows each came from -- a photographed
// problem is often several "P(X) = value" facts stacked up rather than a
// single expression, and the UI shows each line's original strip next to
// what was read from it so a misread is obvious at a glance.
function recognizeLinesDetailed(canvas, templates, canvasFactory) {
  const isInk = buildInkTester(canvas);
  const rows = refineRowBands(canvas, segmentRows(canvas, isInk));
  return rows.map(r => ({ text: recognizeOneBand(canvas, r.top, r.bottom, templates, canvasFactory), top: r.top, bottom: r.bottom }));
}

function recognizeMultiLine(canvas, templates, canvasFactory) {
  return recognizeLinesDetailed(canvas, templates, canvasFactory).map(l => l.text);
}

let _imgTemplatesCache = null;
function getImgTemplates() {
  if (!_imgTemplatesCache) _imgTemplatesCache = renderTemplates(makeCanvasEl);
  return _imgTemplatesCache;
}
