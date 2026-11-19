// Colour grading for Vice Cover Studio, round 4.
//
// The Vice City look is built from four passes, all clipped to the
// panel being painted:
//   1. a warm wash — orange at the top, magenta mid-way, teal shadows
//   2. a halftone dot screen in the lower half, for the printed-comic feel
//   3. a vignette that darkens the corners
//   4. seeded film grain, so preview and export are pixel-identical
//
// Everything is deterministic: the same panel always grades the same way,
// which is what makes the exported PNG match the live preview.

// A tiny xorshift generator. Seeded per panel so the grain pattern never
// changes between the preview and the export.
function xorshift(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296);
  };
}

/** Warm sunset wash over a clipped panel. */
function wash(ctx, r) {
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0.0, 'rgba(255, 132, 46, 0.20)');
  g.addColorStop(0.45, 'rgba(255, 46, 128, 0.12)');
  g.addColorStop(1.0, 'rgba(8, 196, 214, 0.16)');
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.globalCompositeOperation = 'source-over';
}

/** Halftone dots fading in towards the bottom of the panel. */
function halftone(ctx, r, seed) {
  const rnd = xorshift(seed);
  const step = Math.max(7, Math.round(r.w / 160));
  ctx.fillStyle = 'rgba(10, 2, 20, 0.16)';
  for (let y = r.y + r.h * 0.45; y < r.y + r.h; y += step) {
    for (let x = r.x + step / 2; x < r.x + r.w; x += step) {
      const depth = (y - (r.y + r.h * 0.45)) / (r.h * 0.55);
      // Dots grow with depth, and every other row is offset half a step
      // so the screen reads as a staggered print pattern.
      const row = Math.floor((y - r.y) / step) % 2;
      const ox = row ? step / 2 : 0;
      const rad = (0.6 + rnd() * 1.4) * (depth * depth + 0.15) * (step / 3.4);
      ctx.beginPath();
      ctx.arc(x + ox, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Darkened corners. */
function vignette(ctx, r) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const v = ctx.createRadialGradient(
    cx, cy, Math.min(r.w, r.h) * 0.32,
    cx, cy, Math.max(r.w, r.h) * 0.72,
  );
  v.addColorStop(0, 'rgba(10, 0, 22, 0)');
  v.addColorStop(1, 'rgba(10, 0, 22, 0.42)');
  ctx.fillStyle = v;
  ctx.fillRect(r.x, r.y, r.w, r.h);
}

/** Seeded grain: a scatter of light and dark specks. */
function grain(ctx, r, seed) {
  const rnd = xorshift(seed);
  const n = Math.floor((r.w * r.h) / 900);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.055)';
  for (let i = 0; i < n; i++) {
    ctx.fillRect(r.x + rnd() * r.w, r.y + rnd() * r.h, 1.5, 1.5);
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.07)';
  for (let i = 0; i < n; i++) {
    ctx.fillRect(r.x + rnd() * r.w, r.y + rnd() * r.h, 1.5, 1.5);
  }
}

/**
 * Grade one panel: clip to it, run the four passes, restore.
 * `seed` should be stable per panel index.
 */
export function gradePanel(ctx, rect, seed) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  wash(ctx, rect);
  halftone(ctx, rect, seed * 31 + 7);
  vignette(ctx, rect);
  grain(ctx, rect, seed * 101 + 13);
  ctx.restore();
}
