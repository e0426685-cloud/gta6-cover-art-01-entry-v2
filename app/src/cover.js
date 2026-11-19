// Vice Cover Studio — GTA 6-style cover renderer.
//
// renderCover(ctx, state, W, H) paints the whole poster on a canvas. The live
// preview and the exported PNG both call this one function, so the file you
// download is exactly the cover you see on screen. Each panel shows one of
// the user's photos (or a built-in sample), graded with a Vice City
// sunset/neon look, split by thick comic-book gutters, and captioned with
// Anton block capitals plus a glowing Pacifico script line. Everything here
// is original — no Rockstar artwork, logo or font is used anywhere.

/** Panel geometry for each layout, as fractions of the cover size. */
export const LAYOUTS = {
  // One wide hero panel on top, two small panels sharing the strip below.
  hero: (W, H) => {
    const g = Math.round(W * 0.012);
    const split = Math.round(H * 0.6);
    const half = Math.floor((W - 3 * g) / 2);
    return [
      { x: g, y: g, w: W - 2 * g, h: split - g },
      { x: g, y: split + g, w: half, h: H - split - 2 * g },
      { x: 2 * g + half, y: split + g, w: W - 3 * g - half, h: H - split - 2 * g },
    ];
  },
  // The classic comic-book 2 x 2 grid.
  grid: (W, H) => {
    const g = Math.round(W * 0.012);
    const cw = Math.floor((W - 3 * g) / 2);
    const ch = Math.floor((H - 3 * g) / 2);
    return [
      { x: g, y: g, w: cw, h: ch },
      { x: 2 * g + cw, y: g, w: W - 3 * g - cw, h: ch },
      { x: g, y: 2 * g + ch, w: cw, h: H - 3 * g - ch },
      { x: 2 * g + cw, y: 2 * g + ch, w: W - 3 * g - cw, h: H - 3 * g - ch },
    ];
  },
  // Three tall columns, a triptych poster.
  columns: (W, H) => {
    const g = Math.round(W * 0.012);
    const cw = Math.floor((W - 4 * g) / 3);
    return [
      { x: g, y: g, w: cw, h: H - 2 * g },
      { x: 2 * g + cw, y: g, w: cw, h: H - 2 * g },
      { x: 3 * g + 2 * cw, y: g, w: W - 4 * g - 2 * cw, h: H - 2 * g },
    ];
  },
};

/** Panel rectangles for a layout name; unknown names fall back to hero. */
export function layoutRects(layout, W, H) {
  const fn = LAYOUTS[layout] || LAYOUTS.hero;
  return fn(W, H);
}

// Seeded pseudo-random numbers, so the film grain is identical on every
// draw — the export matches the preview pixel for pixel.
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Paints one photo into a panel. crop = { zoom, ox, oy, flip } where ox/oy
 * are -1..1 fractions of how far the photo may pan inside the panel.
 */
function paintPhoto(ctx, photo, rect, crop) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (!photo) {
    // No photo yet: a waiting sunset — gradient sky and a low sun.
    const sky = ctx.createLinearGradient(0, y, 0, y + h);
    sky.addColorStop(0, '#ff9a5a');
    sky.addColorStop(0.55, '#ff5e8a');
    sky.addColorStop(1, '#3b1d5e');
    ctx.fillStyle = sky;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.42, Math.min(w, h) * 0.16, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const iw = photo.naturalWidth || photo.width;
    const ih = photo.naturalHeight || photo.height;
    const zoom = crop?.zoom ?? 1;
    const scale = Math.max(w / iw, h / ih) * zoom;
    const dw = iw * scale;
    const dh = ih * scale;
    const maxOx = Math.max(0, (dw - w) / 2);
    const maxOy = Math.max(0, (dh - h) / 2);
    const cx = x + w / 2 + (crop?.ox ?? 0) * maxOx;
    const cy = y + h / 2 + (crop?.oy ?? 0) * maxOy;
    ctx.translate(cx, cy);
    if (crop?.flip) ctx.scale(-1, 1);
    ctx.drawImage(photo, -dw / 2, -dh / 2, dw, dh);
  }
  ctx.restore();
}

/** Sunset grade, vignette and grain, clipped to one panel. */
function gradePanel(ctx, rect, seed) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  // Warm pink wash up top fading to teal shadows at the bottom.
  const wash = ctx.createLinearGradient(0, y, 0, y + h);
  wash.addColorStop(0, 'rgba(255, 122, 60, 0.16)');
  wash.addColorStop(0.5, 'rgba(255, 45, 120, 0.10)');
  wash.addColorStop(1, 'rgba(0, 190, 210, 0.14)');
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = wash;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'source-over';
  // Darkened corners.
  const vig = ctx.createRadialGradient(
    x + w / 2, y + h / 2, Math.min(w, h) * 0.35,
    x + w / 2, y + h / 2, Math.max(w, h) * 0.75,
  );
  vig.addColorStop(0, 'rgba(12, 0, 24, 0)');
  vig.addColorStop(1, 'rgba(12, 0, 24, 0.38)');
  ctx.fillStyle = vig;
  ctx.fillRect(x, y, w, h);
  // Grain, seeded so it never changes between preview and export.
  const rnd = seededRandom(seed);
  const n = Math.floor((w * h) / 1400);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  for (let i = 0; i < n; i++) ctx.fillRect(x + rnd() * w, y + rnd() * h, 1.6, 1.6);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
  for (let i = 0; i < n; i++) ctx.fillRect(x + rnd() * w, y + rnd() * h, 1.6, 1.6);
  ctx.restore();
}

/** The thick black comic frame, with a thin white inner hairline. */
function framePanel(ctx, rect, width) {
  ctx.save();
  ctx.lineWidth = width;
  ctx.strokeStyle = '#0d0a12';
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.lineWidth = Math.max(1, width * 0.12);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.strokeRect(
    rect.x + width * 0.7, rect.y + width * 0.7,
    rect.w - width * 1.4, rect.h - width * 1.4,
  );
  ctx.restore();
}

/** Largest font size (<= startSize) that fits the text inside maxWidth. */
function shrinkToFit(ctx, text, family, weight, startSize, maxWidth) {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

/**
 * Paints the whole cover.
 *
 * state = {
 *   layout, title, subtitle, tagline,
 *   panels: [{ photo, zoom, ox, oy, flip }, ...]   // photo: HTMLImageElement | null
 * }
 */
export function renderCover(ctx, state, W, H) {
  // Plum backing — it shows through as the gutters between panels.
  ctx.fillStyle = '#0d0a12';
  ctx.fillRect(0, 0, W, H);

  const rects = layoutRects(state.layout, W, H);
  const frame = Math.max(4, Math.round(W * 0.012));
  rects.forEach((rect, i) => {
    // A soft drop shadow so the panels lift off the plum backing.
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(rect.x + frame * 0.6, rect.y + frame * 0.6, rect.w, rect.h);
    ctx.restore();
    const p = state.panels[i] || {};
    paintPhoto(ctx, p.photo || null, rect, p);
    gradePanel(ctx, rect, 1234 + i * 777);
    framePanel(ctx, rect, frame);
  });

  // A dark gradient across the lower part so the caption stays readable
  // over any photo.
  const shade = ctx.createLinearGradient(0, H * 0.55, 0, H);
  shade.addColorStop(0, 'rgba(13, 10, 18, 0)');
  shade.addColorStop(1, 'rgba(13, 10, 18, 0.72)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, H * 0.55, W, H * 0.45);

  const title = (state.title || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim();
  const tagline = (state.tagline || '').trim().toUpperCase();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  // A slight pulp tilt for the whole caption block.
  ctx.translate(W / 2, H * 0.94);
  ctx.rotate(-0.018);
  ctx.translate(-W / 2, -H * 0.94);

  if (subtitle) {
    const size = shrinkToFit(ctx, subtitle, '"Pacifico", cursive', 400, W * 0.042, W * 0.86);
    ctx.font = `${size}px "Pacifico", cursive`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size * 0.09);
    ctx.strokeStyle = 'rgba(13, 10, 18, 0.85)';
    ctx.strokeText(subtitle, W / 2, H * 0.755);
    ctx.fillStyle = '#ff7ad9';
    ctx.shadowColor = '#ff2ea6';
    ctx.shadowBlur = size * 0.55;
    ctx.fillText(subtitle, W / 2, H * 0.755);
    ctx.shadowBlur = 0;
  }
  if (title) {
    const size = shrinkToFit(ctx, title, '"Anton", sans-serif', 400, W * 0.085, W * 0.94);
    ctx.font = `${size}px "Anton", sans-serif`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size * 0.16);
    ctx.strokeStyle = '#0d0a12';
    ctx.shadowColor = '#ff2ea6';
    ctx.shadowBlur = size * 0.18;
    ctx.shadowOffsetY = size * 0.04;
    ctx.strokeText(title, W / 2, H * 0.905);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, W / 2, H * 0.905);
  }
  if (tagline) {
    const size = Math.max(10, W * 0.021);
    ctx.font = `${size}px "Anton", sans-serif`;
    try { ctx.letterSpacing = `${Math.round(size * 0.35)}px`; } catch { /* older canvas */ }
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(tagline, W / 2, H * 0.972);
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  }
  ctx.restore();
}
