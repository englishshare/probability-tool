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
  for (const ch of ALPHABET) {
    for (const v of variants) {
      wctx.setTransform(1, 0, 0, 1, 0, 0);
      wctx.fillStyle = '#fff'; wctx.fillRect(0, 0, SIZE, SIZE);
      wctx.fillStyle = '#000'; wctx.font = v.font; wctx.textBaseline = 'alphabetic';
      // right-leaning shear about the baseline, synthesizing an italic-ish
      // slant on top of the upright fonts for in-between coverage
      wctx.setTransform(1, 0, -v.shear, 1, v.shear * BASE, 0);
      wctx.fillText(ch, 14, BASE);
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
function buildLocalInkTester(canvas, top, bottom) {
  const w = canvas.width;
  const h = bottom - top + 1;
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, top, w, h).data;
  const inverted = detectPolarity(data, w, h) === 'inverted';
  return (x, y) => {
    const ly = y - top;
    if (ly < 0 || ly >= h || x < 0 || x >= w) return false;
    const i = (ly * w + x) * 4;
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
    return inverted ? gray >= 128 : gray < 128;
  };
}

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
  return { labels, comps, w, h };
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
  const used = new Set();
  const groups = [];
  for (const a of rest) {
    if (used.has(a.id)) continue;
    used.add(a.id);
    if (isFlat(a)) {
      let partner = null;
      for (const b of rest) {
        if (b === a || used.has(b.id) || !isFlat(b)) continue;
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

function glyphBitmap(info, group, canvasFactory) {
  const bw = group.maxX - group.minX + 1, bh = group.maxY - group.minY + 1;
  const tmp = canvasFactory(bw, bh);
  const tctx = tmp.getContext('2d');
  const img = tctx.createImageData(bw, bh);
  for (let i = 0; i < img.data.length; i += 4) { img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = 255; }
  for (let y = group.minY; y <= group.maxY; y++) {
    for (let x = group.minX; x <= group.maxX; x++) {
      if (group.ids.has(info.labels[y * info.w + x])) {
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

function recognizeOneBand(canvas, top, bottom, templates, canvasFactory) {
  const localIsInk = buildLocalInkTester(canvas, top, bottom);
  const info = labelComponents(localIsInk, canvas.width, top, bottom);
  const groups = buildGlyphGroups(info.comps);
  const ranks = groups.map(g => rankGlyph(glyphBitmap(info, g, canvasFactory), g, templates));
  const chars = ranks.map(r => pickBest(r));
  // What follows the last "=" is a number, so only digits and a decimal
  // point are plausible there -- a letter in that spot ("2" read as "D",
  // a "0" as "Q") is a misread by construction, and re-picking among just
  // the numeric glyphs repairs it using the shape evidence already
  // computed rather than leaving the person to spot it.
  const lastEq = chars.lastIndexOf('=');
  if (lastEq !== -1) {
    for (let i = lastEq + 1; i < chars.length; i++) chars[i] = pickBest(ranks[i], ch => VALUE_CHARS.has(ch));
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
