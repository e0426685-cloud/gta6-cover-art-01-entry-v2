// Vice Cover Studio — poster renderer, round 6.
//
// paintPoster(ctx, poster, W, H) draws the whole cover. The live preview
// and the exported PNG call this same function, so the download is
// exactly the cover on screen.
//
//   poster = {
//     layout, title, script, tagline,
//     panels: [{ img, zoom, ox, oy, flip }, ...]
//   }
//
// Layouts come from a fraction grid: each layout is a list of cells
// { x, y, w, h } in 0..1, so adding a layout is one table row, not a
// new pile of split calls. A panel slot keeps a pan offset (ox, oy in
// -1..1) instead of a focal point: dragging the photo slides it inside
// the panel, and the offset means the same thing at any zoom. The grade
// is a chain of small effects run in order, and the caption band is one
// plum strip with three lines of lettering.
//
// No Rockstar artwork, logo or font is used anywhere.

// ---- layout grids ----------------------------------------------------------

// Cells are fractions of the poster. A gutter of half the gap is cut
// from every cell so the plum backing shows through between panels.
const LAYOUTS = {
  // Tall hero on the left, two stacked panels on the right.
  cinema: [
    { x: 0, y: 0, w: 0.62, h: 1 },
    { x: 0.62, y: 0, w: 0.38, h: 0.5 },
    { x: 0.62, y: 0.5, w: 0.38, h: 0.5 },
  ],
  // Wide band on top, three equal panels along the bottom.
  mosaic: [
    { x: 0, y: 0, w: 1, h: 0.55 },
    { x: 0, y: 0.55, w: 1 / 3, h: 0.45 },
    { x: 1 / 3, y: 0.55, w: 1 / 3, h: 0.45 },
    { x: 2 / 3, y: 0.55, w: 1 / 3, h: 0.45 },
  ],
  // Three columns, the middle one wider than its neighbours.
  triptych: [
    { x: 0, y: 0, w: 0.28, h: 1 },
    { x: 0.28, y: 0, w: 0.44, h: 1 },
    { x: 0.72, y: 0, w: 0.28, h: 1 },
  ],
};

export const LAYOUT_NAMES = ['cinema', 'mosaic', 'triptych'];

/** Pixel rectangles for a layout, each shrunk by half a gutter. */
export function layoutRects(layout, W, H) {
  const spec = LAYOUTS[layout] || LAYOUTS.cinema;
  const gap = Math.max(3, Math.round(W * 0.014));
  const half = gap / 2;
  return spec.map((c) => ({
    x: Math.round(c.x * W) + half,
    y: Math.round(c.y * H) + half,
    w: Math.round(c.w * W) - gap,
    h: Math.round(c.h * H) - gap,
  }));
}

/** How many panels a layout has. */
export function panelCount(layout) {
  return (LAYOUTS[layout] || LAYOUTS.cinema).length;
}

// ---- deterministic hash ----------------------------------------------------

// A tiny integer hash for the halftone screen: the same (x, y, seed)
// always gives the same dot, so the preview and the export match.
function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 974634) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---- photo -----------------------------------------------------------------

/** Paint one photo into a panel, slid by its pan offset. */
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
  // The pan offset slides the photo inside the panel: 0 is centred,
  // +1 pushes it as far right/down as the cover allows.
  const ox = slot.ox ?? 0;
  const oy = slot.oy ?? 0;
  const dx = (ox * (dw - rect.w)) / 2;
  const dy = (oy * (dh - rect.h)) / 2;
  ctx.save();
  ctx.translate(rect.x + rect.w / 2 + dx, rect.y + rect.h / 2 + dy);
  if (slot.flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

// ---- grade effects ---------------------------------------------------------

/** Warm sunset wash, diagonal, blended soft-light. */
function warmGradient(ctx, r) {
  const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
  g.addColorStop(0, 'rgba(255, 120, 40, 0.25)');
  g.addColorStop(0.5, 'rgba(255, 40, 140, 0.18)');
  g.addColorStop(1, 'rgba(0, 190, 220, 0.20)');
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.globalCompositeOperation = 'source-over';
}

/** Halftone dots that fade in towards the bottom of the panel. */
function halftone(ctx, r, seed) {
  const step = Math.max(8, Math.round(r.w / 120));
  const top = r.y + r.h * 0.55;
  for (let y = top; y < r.y + r.h; y += step) {
    const depth = (y - top) / (r.h * 0.45);
    const row = Math.floor((y - r.y) / step) % 2;
    for (let x = r.x + step / 2 + (row ? step / 2 : 0); x < r.x + r.w; x += step) {
      const jitter = hash2(Math.round(x / step), Math.round(y / step), seed);
      const rad = (0.4 + jitter * 1.2) * (depth * depth + 0.12) * (step / 3);
      ctx.fillStyle = `rgba(10, 2, 20, ${(0.10 + depth * 0.22).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** A dark vignette that pulls the eye to the panel centre. */
function vignette(ctx, r) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const v = ctx.createRadialGradient(
    cx, cy, Math.min(r.w, r.h) * 0.3,
    cx, cy, Math.max(r.w, r.h) * 0.72,
  );
  v.addColorStop(0, 'rgba(5, 0, 15, 0)');
  v.addColorStop(1, 'rgba(5, 0, 15, 0.5)');
  ctx.fillStyle = v;
  ctx.fillRect(r.x, r.y, r.w, r.h);
}

// A tiny linear congruential generator for the grain pass.
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Film grain: sparse dark specks drawn straight onto the panel. */
function grain(ctx, r, seed) {
  const rnd = lcg(seed);
  const count = Math.floor((r.w * r.h) / 260);
  ctx.fillStyle = 'rgba(10, 2, 20, 0.16)';
  for (let i = 0; i < count; i++) {
    const x = r.x + rnd() * r.w;
    const y = r.y + rnd() * r.h;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
}

/** The grade chain, run in order inside the panel clip. */
const GRADE_CHAIN = [warmGradient, halftone, vignette, grain];

export function gradePanel(ctx, rect, seed) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  GRADE_CHAIN.forEach((effect, i) => effect(ctx, rect, seed * 131 + i * 7919));
  ctx.restore();
}

// ---- frame -----------------------------------------------------------------

/** Thick black comic frame plus a thin gold inner line. */
function drawFrame(ctx, rect, width) {
  ctx.lineWidth = width;
  ctx.strokeStyle = '#0d0a12';
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.lineWidth = Math.max(1, width * 0.16);
  ctx.strokeStyle = 'rgba(201, 162, 77, 0.85)';
  ctx.strokeRect(
    rect.x + width * 0.7, rect.y + width * 0.7,
    rect.w - width * 1.4, rect.h - width * 1.4,
  );
}

// ---- lettering --------------------------------------------------------------

/**
 * Step the font size down by twos until the text fits maxWidth.
 * Simple, and the sizes land on even numbers every time.
 */
function fitText(ctx, text, family, start, maxWidth) {
  let size = start;
  ctx.font = `400 ${size}px ${family}`;
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `400 ${size}px ${family}`;
  }
  return size;
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

/** The caption band: plum strip, gold rule, three lettering lines. */
function drawCaption(ctx, poster, W, H) {
  // The band is tall enough (0.28H) for all three lines to sit inside
  // it: the script's ascenders must clear the band's top edge, and the
  // title's cap height must clear the script's descenders.
  const bandTop = H * 0.72;
  const band = ctx.createLinearGradient(0, bandTop, 0, H);
  band.addColorStop(0, '#1a0f2e');
  band.addColorStop(1, '#0b0812');
  ctx.fillStyle = band;
  ctx.fillRect(0, bandTop, W, H - bandTop);
  ctx.fillStyle = '#c9a24d';
  ctx.fillRect(0, bandTop, W, Math.max(2, H * 0.004));

  const title = (poster.title || '').trim().toUpperCase();
  const script = (poster.script || '').trim();
  const tagline = (poster.tagline || '').trim().toUpperCase();

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // A slight pulp tilt for the whole caption block.
  ctx.translate(W / 2, H * 0.885);
  ctx.rotate(-0.02);
  ctx.translate(-W / 2, -H * 0.885);

  if (script) {
    const size = fitText(ctx, script, '"Pacifico", cursive', Math.round(W * 0.034), W * 0.84);
    ctx.font = `${size}px "Pacifico", cursive`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size * 0.08);
    ctx.strokeStyle = 'rgba(13, 10, 18, 0.9)';
    ctx.textAlign = 'center';
    ctx.strokeText(script, W / 2, H * 0.79);
    ctx.fillStyle = '#ff7ad9';
    ctx.shadowColor = '#ff2ea6';
    ctx.shadowBlur = size * 0.6;
    ctx.fillText(script, W / 2, H * 0.79);
    ctx.shadowBlur = 0;
  }
  if (title) {
    const size = fitText(ctx, title, '"Anton", sans-serif', Math.round(W * 0.062), W * 0.93);
    ctx.font = `${size}px "Anton", sans-serif`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size * 0.15);
    ctx.strokeStyle = '#0d0a12';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff2ea6';
    ctx.shadowBlur = size * 0.16;
    ctx.shadowOffsetX = size * 0.05;
    ctx.shadowOffsetY = size * 0.05;
    ctx.strokeText(title, W / 2, H * 0.885);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, W / 2, H * 0.885);
  }
  if (tagline) {
    const size = Math.max(10, Math.round(W * 0.02));
    ctx.font = `${size}px "Anton", sans-serif`;
    ctx.textAlign = 'left'; // trackedText places each glyph by hand
    ctx.fillStyle = '#ffe9a8';
    const half = trackedText(ctx, tagline, W / 2, H * 0.945, size * 0.4) / 2;
    // Two short gold rules flanking the tagline.
    const ruleLen = size * 1.6;
    const ruleY = H * 0.945 - size * 0.32;
    ctx.fillRect(W / 2 - half - ruleLen - size * 0.7, ruleY, ruleLen, Math.max(2, size * 0.09));
    ctx.fillRect(W / 2 + half + size * 0.7, ruleY, ruleLen, Math.max(2, size * 0.09));
  }
  ctx.restore();
}

/** Plum backing with a faint warm glow behind the panels. */
function coverBackground(ctx, W, H) {
  ctx.fillStyle = '#0d0a12';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(
    W / 2, H * 0.35, Math.min(W, H) * 0.1,
    W / 2, H * 0.35, Math.max(W, H) * 0.7,
  );
  glow.addColorStop(0, 'rgba(255, 94, 138, 0.10)');
  glow.addColorStop(1, 'rgba(255, 94, 138, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}

// ---- whole poster -----------------------------------------------------------

/** Paint the whole poster on ctx at W x H. */
export function paintPoster(ctx, poster, W, H) {
  coverBackground(ctx, W, H);

  const rects = layoutRects(poster.layout, W, H);
  const frame = Math.max(4, Math.round(W * 0.013));
  rects.forEach((rect, i) => {
    // A soft drop shadow so the panels lift off the backing.
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(rect.x + frame * 0.6, rect.y + frame * 0.6, rect.w, rect.h);
    ctx.restore();

    const slot = poster.panels[i] || {};
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    paintPhoto(ctx, slot.img || null, rect, slot);
    ctx.restore();

    gradePanel(ctx, rect, 4243 + i * 977);
    drawFrame(ctx, rect, frame);
  });

  drawCaption(ctx, poster, W, H);
}
