// The cover painter for Vice Cover Studio, round 4.
//
// paintPoster(ctx, doc, W, H) draws the whole poster. The live preview
// and the exported PNG call this same function, so the file you download
// is exactly the cover on screen.
//
//   doc = {
//     layout, title, script, tagline,
//     panels: [{ img, scale, dx, dy, mirror }, ...]
//   }
//
// The poster is built in layers: a plum backing (it shows through as the
// gutters), one photo per panel with a comic frame, a solid caption band
// across the bottom with gold hairlines, and the lettering — a glowing
// Pacifico script line, an Anton block title, a letterspaced tagline.
// No Rockstar artwork, logo or font is used anywhere.

import { panelRects } from './layouts.js';
import { gradePanel } from './grade.js';

/** Fit one photo into a panel rect, honouring scale/pan/mirror. */
function drawPhoto(ctx, img, rect, slot) {
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
  const scale = Math.max(rect.w / iw, rect.h / ih) * (slot.scale ?? 1);
  const dw = iw * scale;
  const dh = ih * scale;
  const slackX = Math.max(0, (dw - rect.w) / 2);
  const slackY = Math.max(0, (dh - rect.h) / 2);
  const cx = rect.x + rect.w / 2 + (slot.dx ?? 0) * slackX;
  const cy = rect.y + rect.h / 2 + (slot.dy ?? 0) * slackY;
  ctx.translate(cx, cy);
  if (slot.mirror) ctx.scale(-1, 1);
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
}

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

/** The biggest size (<= start) at which text fits inside maxWidth. */
function fitSize(ctx, text, family, start, maxWidth) {
  let size = start;
  ctx.font = `400 ${size}px ${family}`;
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `400 ${size}px ${family}`;
  }
  return size;
}

/** The caption band: plum strip, gold rules, script + title + tagline. */
function drawCaption(ctx, doc, W, H) {
  // The band is tall enough (0.26H) for all three lines to sit inside
  // it: the script's ascenders must clear the band's top edge, and the
  // title's cap height must clear the script's descenders.
  const bandTop = H * 0.74;
  ctx.fillStyle = '#0d0a12';
  ctx.fillRect(0, bandTop, W, H - bandTop);
  ctx.fillStyle = '#c9a24d';
  ctx.fillRect(0, bandTop, W, Math.max(2, H * 0.004));
  ctx.fillRect(0, H - Math.max(2, H * 0.004), W, Math.max(2, H * 0.004));

  const title = (doc.title || '').trim().toUpperCase();
  const script = (doc.script || '').trim();
  const tagline = (doc.tagline || '').trim().toUpperCase();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  // A slight pulp tilt for the whole caption block.
  ctx.translate(W / 2, H * 0.92);
  ctx.rotate(-0.03);
  ctx.translate(-W / 2, -H * 0.92);

  if (script) {
    const size = fitSize(ctx, script, '"Pacifico", cursive', W * 0.036, W * 0.84);
    ctx.font = `${size}px "Pacifico", cursive`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size * 0.08);
    ctx.strokeStyle = 'rgba(13, 10, 18, 0.9)';
    ctx.strokeText(script, W / 2, H * 0.815);
    ctx.fillStyle = '#ff7ad9';
    ctx.shadowColor = '#ff2ea6';
    ctx.shadowBlur = size * 0.6;
    ctx.fillText(script, W / 2, H * 0.815);
    ctx.shadowBlur = 0;
  }
  if (title) {
    const size = fitSize(ctx, title, '"Anton", sans-serif', W * 0.068, W * 0.93);
    ctx.font = `${size}px "Anton", sans-serif`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size * 0.15);
    ctx.strokeStyle = '#0d0a12';
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
    try { ctx.letterSpacing = `${Math.round(size * 0.4)}px`; } catch { /* older canvas */ }
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(tagline, W / 2, H * 0.968);
    // Two small gold diamonds flanking the tagline.
    const half = ctx.measureText(tagline).width / 2 + size * 1.1;
    const dia = Math.max(3, size * 0.28);
    ctx.save();
    ctx.translate(W / 2 - half, H * 0.968 - size * 0.32);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-dia / 2, -dia / 2, dia, dia);
    ctx.translate(half * 2, 0);
    ctx.fillRect(-dia / 2, -dia / 2, dia, dia);
    ctx.restore();
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  }
  ctx.restore();
}

/** Paint the whole poster on ctx at W x H. */
export function paintPoster(ctx, doc, W, H) {
  // Plum backing — it shows through as the gutters between panels.
  ctx.fillStyle = '#0d0a12';
  ctx.fillRect(0, 0, W, H);

  const rects = panelRects(doc.layout, W, H);
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
    drawPhoto(ctx, slot.img || null, rect, slot);
    ctx.restore();

    gradePanel(ctx, rect, 9001 + i * 313);
    drawFrame(ctx, rect, frame);
  });

  drawCaption(ctx, doc, W, H);
}
