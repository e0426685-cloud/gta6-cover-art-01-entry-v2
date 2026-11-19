// Vice Cover Studio — cover renderer, round 5.
//
// renderCover(ctx, doc, W, H) paints the whole poster. The live preview
// and the exported PNG call this same function, so the download is
// exactly the cover on screen.
//
//   doc = {
//     layout, title, script, tagline,
//     panels: [{ img, zoom, fx, fy, flip }, ...]
//   }
//
// A panel slot keeps a focal point (fx, fy in 0..1) instead of a pan
// offset: dragging the photo moves the point the panel is centred on,
// which makes the crop behave the same at any zoom. The grade is a
// pipeline of small passes run in order, and the caption band is one
// gradient strip with three lines of lettering.
//
// No Rockstar artwork, logo or font is used anywhere.

// ---- geometry ------------------------------------------------------------

/** Shrink a rect by `pad` on every side. */
function inset(r, pad) {
  return { x: r.x + pad, y: r.y + pad, w: r.w - pad * 2, h: r.h - pad * 2 };
}

/** Split a rect horizontally into a top part of `frac` and the rest. */
function splitH(r, frac) {
  const cut = Math.round(r.h * frac);
  return [
    { x: r.x, y: r.y, w: r.w, h: cut },
    { x: r.x, y: r.y + cut, w: r.w, h: r.h - cut },
  ];
}

/** Split a rect vertically into a left part of `frac` and the rest. */
function splitV(r, frac) {
  const cut = Math.round(r.w * frac);
  return [
    { x: r.x, y: r.y, w: cut, h: r.h },
    { x: r.x + cut, y: r.y, w: r.w - cut, h: r.h },
  ];
}

/** Split a rect into `n` equal vertical columns. */
function columns(r, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const x0 = Math.round((r.w * i) / n);
    const x1 = Math.round((r.w * (i + 1)) / n);
    out.push({ x: r.x + x0, y: r.y, w: x1 - x0, h: r.h });
  }
  return out;
}

/**
 * Panel rectangles for a layout, each inset by half a gutter so the
 * backing shows through between neighbours.
 *
 *   cinema   — tall hero on the left, two stacked panels on the right
 *   mosaic   — wide band on top, three equal panels along the bottom
 *   triptych — three columns, the middle one wider than its neighbours
 */
export function layoutRects(layout, W, H) {
  const g = Math.max(3, Math.round(W * 0.014));
  const half = g / 2;
  const full = { x: 0, y: 0, w: W, h: H };
  let cells;
  if (layout === 'mosaic') {
    const [top, bottom] = splitH(full, 0.52);
    cells = [top, ...columns(bottom, 3)];
  } else if (layout === 'triptych') {
    const [left, rest] = splitV(full, 0.30);
    const [mid, right] = splitV(rest, 0.5714);
    cells = [left, mid, right];
  } else {
    // cinema (default)
    const [hero, stack] = splitV(full, 0.64);
    cells = [hero, ...splitH(stack, 0.5)];
  }
  return cells.map((c) => inset(c, half));
}

/** How many panels a layout has. */
export function panelCount(layout) {
  return layoutRects(layout, 100, 100).length;
}

export const LAYOUT_NAMES = ['cinema', 'mosaic', 'triptych'];

// ---- deterministic random ------------------------------------------------

// Mulberry32: small, fast, and seeded per panel so the grain pattern is
// identical in the preview and in the export.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- photo ----------------------------------------------------------------

/** Paint one photo into a panel, centred on its focal point. */
function paintPhoto(ctx, img, rect, slot) {
  if (!img) {
    // Empty panel: a waiting sunset — gradient sky and a low sun.
    const sky = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    sky.addColorStop(0, '#ff9a5a');
    sky.addColorStop(0.55, '#ff5e8a');
    sky.addColorStop(1, '#3b1d5e');
    ctx.fillStyle = sky;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(
      rect.x + rect.w / 2, rect.y + rect.h * 0.42,
      Math.min(rect.w, rect.h) * 0.16, 0, Math.PI * 2,
    );
    ctx.fill();
    return;
  }
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const zoom = slot.zoom ?? 1;
  const scale = Math.max(rect.w / iw, rect.h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  // The focal point (fx, fy) is the photo point that sits at the panel
  // centre; clamp so the photo always covers the panel.
  const fx = slot.fx ?? 0.5;
  const fy = slot.fy ?? 0.5;
  const cx = rect.x + rect.w / 2 - (fx - 0.5) * (dw - rect.w);
  const cy = rect.y + rect.h / 2 - (fy - 0.5) * (dh - rect.h);
  ctx.save();
  ctx.translate(cx, cy);
  if (slot.flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

// ---- grade passes ---------------------------------------------------------

/** Warm sunset wash: orange top, magenta middle, teal shadows. */
function sunsetWash(ctx, r) {
  const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w * 0.35, r.y + r.h);
  g.addColorStop(0, 'rgba(255, 132, 46, 0.20)');
  g.addColorStop(0.5, 'rgba(255, 46, 128, 0.12)');
  g.addColorStop(1, 'rgba(8, 196, 214, 0.16)');
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.globalCompositeOperation = 'source-over';
}

/** Halftone dots fading in towards the bottom of the panel. */
function dotScreen(ctx, r, seed) {
  const rnd = mulberry32(seed);
  const step = Math.max(7, Math.round(r.w / 150));
  const top = r.y + r.h * 0.42;
  for (let y = top; y < r.y + r.h; y += step) {
    // Dots grow and darken with depth, and every other row is offset
    // half a step so the screen reads as a staggered print pattern.
    const depth = (y - top) / (r.h * 0.58);
    const row = Math.floor((y - r.y) / step) % 2;
    for (let x = r.x + step / 2 + (row ? step / 2 : 0); x < r.x + r.w; x += step) {
      const rad = (0.5 + rnd() * 1.1) * (depth * depth + 0.12) * (step / 3.2);
      ctx.fillStyle = `rgba(10, 2, 20, ${(0.10 + depth * 0.22).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** A soft inner glow that lifts the panel centre. */
function innerGlow(ctx, r) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const v = ctx.createRadialGradient(
    cx, cy, Math.min(r.w, r.h) * 0.25,
    cx, cy, Math.max(r.w, r.h) * 0.75,
  );
  v.addColorStop(0, 'rgba(255, 240, 200, 0.10)');
  v.addColorStop(0.6, 'rgba(10, 0, 22, 0)');
  v.addColorStop(1, 'rgba(10, 0, 22, 0.40)');
  ctx.fillStyle = v;
  ctx.fillRect(r.x, r.y, r.w, r.h);
}

/** Seeded grain from a pre-rendered noise tile, so it is cheap and stable. */
const grainTiles = new Map();
function noiseTile(size, seed) {
  const key = `${size}:${seed}`;
  if (!grainTiles.has(key)) {
    const rnd = mulberry32(seed);
    const tile = document.createElement('canvas');
    tile.width = size;
    tile.height = size;
    const t = tile.getContext('2d');
    const img = t.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(rnd() * 255);
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v;
      img.data[i + 3] = rnd() < 0.5 ? 14 : 0;
    }
    t.putImageData(img, 0, 0);
    grainTiles.set(key, tile);
  }
  return grainTiles.get(key);
}

function grain(ctx, r, seed) {
  const tile = noiseTile(96, seed);
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = ctx.createPattern(tile, 'repeat');
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}

/** The grade pipeline, run in order inside the panel clip. */
const GRADE_PASSES = [sunsetWash, dotScreen, innerGlow, grain];

export function gradePanel(ctx, rect, seed) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  GRADE_PASSES.forEach((pass, i) => pass(ctx, rect, seed * 97 + i * 1009));
  ctx.restore();
}

// ---- frame ----------------------------------------------------------------

/** Thick black comic frame plus a thin pale inner line. */
function drawFrame(ctx, rect, width) {
  ctx.lineWidth = width;
  ctx.strokeStyle = '#0d0a12';
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.lineWidth = Math.max(1, width * 0.14);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.strokeRect(
    rect.x + width * 0.75, rect.y + width * 0.75,
    rect.w - width * 1.5, rect.h - width * 1.5,
  );
}

// ---- lettering -------------------------------------------------------------

/**
 * Binary-search the largest font size (<= start) whose text fits maxWidth.
 * Faster and smoother than stepping down by twos.
 */
function fitFont(ctx, text, family, start, maxWidth) {
  let lo = 10;
  let hi = start;
  const probe = (size) => {
    ctx.font = `400 ${size}px ${family}`;
    return ctx.measureText(text).width;
  };
  if (probe(hi) <= maxWidth) return hi;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (probe(mid) <= maxWidth) lo = mid; else hi = mid;
  }
  return lo;
}

/** Draw text centred, tracking each glyph by hand for even spacing. */
function trackedText(ctx, text, cx, y, tracking) {
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (text.length - 1);
  let x = cx - total / 2;
  [...text].forEach((ch, i) => {
    ctx.fillText(ch, x, y);
    x += widths[i] + tracking;
  });
  return total;
}

/** The caption band: gradient plum strip, gold rules, three lettering lines. */
function drawCaption(ctx, doc, W, H) {
  // The band is tall enough (0.26H) for all three lines to sit inside
  // it: the script's ascenders must clear the band's top edge, and the
  // title's cap height must clear the script's descenders.
  const bandTop = H * 0.74;
  const band = ctx.createLinearGradient(0, bandTop, 0, H);
  band.addColorStop(0, '#17102a');
  band.addColorStop(1, '#0d0a12');
  ctx.fillStyle = band;
  ctx.fillRect(0, bandTop, W, H - bandTop);
  ctx.fillStyle = '#c9a24d';
  ctx.fillRect(0, bandTop, W, Math.max(2, H * 0.004));
  ctx.fillRect(0, H - Math.max(2, H * 0.004), W, Math.max(2, H * 0.004));

  const title = (doc.title || '').trim().toUpperCase();
  const script = (doc.script || '').trim();
  const tagline = (doc.tagline || '').trim().toUpperCase();

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // A slight pulp tilt for the whole caption block.
  ctx.translate(W / 2, H * 0.92);
  ctx.rotate(-0.03);
  ctx.translate(-W / 2, -H * 0.92);

  if (script) {
    const size = fitFont(ctx, script, '"Pacifico", cursive', W * 0.036, W * 0.84);
    ctx.font = `${size}px "Pacifico", cursive`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size * 0.08);
    ctx.strokeStyle = 'rgba(13, 10, 18, 0.9)';
    ctx.textAlign = 'center';
    ctx.strokeText(script, W / 2, H * 0.815);
    ctx.fillStyle = '#ff7ad9';
    ctx.shadowColor = '#ff2ea6';
    ctx.shadowBlur = size * 0.6;
    ctx.fillText(script, W / 2, H * 0.815);
    ctx.shadowBlur = 0;
  }
  if (title) {
    const size = fitFont(ctx, title, '"Anton", sans-serif', W * 0.068, W * 0.93);
    ctx.font = `${size}px "Anton", sans-serif`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size * 0.15);
    ctx.strokeStyle = '#0d0a12';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff2ea6';
    ctx.shadowBlur = size * 0.16;
    ctx.shadowOffsetX = size * 0.05;
    ctx.shadowOffsetY = size * 0.05;
    ctx.strokeText(title, W / 2, H * 0.92);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, W / 2, H * 0.92);
  }
  if (tagline) {
    const size = Math.max(10, W * 0.02);
    ctx.font = `${size}px "Anton", sans-serif`;
    ctx.textAlign = 'left'; // trackedText places each glyph by hand
    ctx.fillStyle = '#ffe9a8';
    const half = trackedText(ctx, tagline, W / 2, H * 0.968, size * 0.4) / 2 + size * 1.1;
    // Two small gold diamonds flanking the tagline.
    const dia = Math.max(3, size * 0.28);
    for (const sx of [-1, 1]) {
      ctx.save();
      ctx.translate(W / 2 + sx * half, H * 0.968 - size * 0.32);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-dia / 2, -dia / 2, dia, dia);
      ctx.restore();
    }
  }
  ctx.restore();
}

// ---- whole poster ----------------------------------------------------------

/** Paint the whole poster on ctx at W x H. */
export function renderCover(ctx, doc, W, H) {
  // Plum backing — it shows through as the gutters between panels.
  ctx.fillStyle = '#0d0a12';
  ctx.fillRect(0, 0, W, H);

  const rects = layoutRects(doc.layout, W, H);
  const frame = Math.max(4, Math.round(W * 0.013));
  rects.forEach((rect, i) => {
    // A soft drop shadow so the panels lift off the backing.
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(rect.x + frame * 0.6, rect.y + frame * 0.6, rect.w, rect.h);
    ctx.restore();

    const slot = doc.panels[i] || {};
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    paintPhoto(ctx, slot.img || null, rect, slot);
    ctx.restore();

    gradePanel(ctx, rect, 9001 + i * 313);
    drawFrame(ctx, rect, frame);
  });

  drawCaption(ctx, doc, W, H);
}
