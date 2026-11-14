// A tiny math typesetter on a canvas: text, subscripts, a bar over one letter
// and stacked fractions -- enough to draw the kind of line a word processor's
// equation editor produces (P(Ā|B₂) = 2/3), without needing the fonts it uses.
function typeset(ctx, tokens, x0, base, size, style) {
  let x = x0;
  const main = `${style}${size}px serif`;
  const small = `${style}${Math.round(size * 0.65)}px serif`;
  const digit = `${Math.round(size * 0.8)}px serif`;
  for (const t of tokens) {
    if (t.t === 'text') { ctx.font = main; ctx.fillText(t.s, x, base); x += ctx.measureText(t.s).width; }
    else if (t.t === 'sub') { ctx.font = small; ctx.fillText(t.s, x, base + size * 0.22); x += ctx.measureText(t.s).width + 1; }
    else if (t.t === 'over') {
      ctx.font = main; const w = ctx.measureText(t.s).width;
      ctx.fillText(t.s, x, base); ctx.fillRect(x + 1, base - size * 0.98, w - 2, 2); x += w;
    } else if (t.t === 'frac') {
      ctx.font = digit;
      const wn = ctx.measureText(t.n).width, wd = ctx.measureText(t.d).width, w = Math.max(wn, wd) + 8;
      const axis = base - size * 0.3;
      ctx.fillRect(x, axis - 1, w, 2);
      ctx.fillText(t.n, x + (w - wn) / 2, axis - 5);
      ctx.fillText(t.d, x + (w - wd) / 2, axis + size * 0.8 * 0.72 + 5);
      x += w + 2;
    }
  }
  return x;
}
module.exports = { typeset };
