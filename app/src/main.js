// Vice Cover Studio — editor wiring, round 4. A `?scene=` query sets up
// a fixed scene for a screenshot (see scenes.js).
import { paintPoster } from './poster.js';
import { panelCount, panelRects, LAYOUT_NAMES } from './layouts.js';
import { runScene } from './scenes.js';

/** Export sizes, in pixels. */
const SIZES = {
  square: { w: 1080, h: 1080, label: '1080 × 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 × 1350' },
  wide: { w: 1920, h: 1080, label: '1920 × 1080' },
};

/** Built-in sample photos shipped with the app. */
const SAMPLES = [
  { name: 'Pier — fishing at noon', url: 'samples/pier.jpg' },
  { name: 'Boulevard — sunset convertible', url: 'samples/boulevard.jpg' },
];

const read = (key, fallback) => {
  try { return localStorage.getItem(`vcs4-${key}`) ?? fallback; } catch { return fallback; }
};
const store = (key, value) => {
  try { localStorage.setItem(`vcs4-${key}`, value); } catch { /* private mode */ }
};

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const sctx = stage.getContext('2d');

// The document being edited. Panels hold one slot per layout position
// (cinema 3, mosaic 4, triptych 3); `img` is an Image element or null.
const doc = {
  layout: read('layout', 'cinema'),
  title: read('title', 'Sunset Heist'),
  script: read('script', 'Welcome to Vice City'),
  tagline: read('tagline', 'A Vice City story'),
  size: read('size', 'wide'),
  panels: Array.from({ length: 4 }, () => ({ img: null, scale: 1, dx: 0, dy: 0, mirror: false })),
};
let library = []; // { name, url, img } — samples plus the user's uploads
let active = 0; // which panel the rail edits right now

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function loadFonts() {
  try {
    const anton = new FontFace('Anton', 'url(./fonts/Anton-Regular.ttf)');
    const pacifico = new FontFace('Pacifico', 'url(./fonts/Pacifico-Regular.ttf)');
    const [a, p] = await Promise.all([anton.load(), pacifico.load()]);
    document.fonts.add(a);
    document.fonts.add(p);
    await document.fonts.ready;
  } catch (e) {
    // System fonts take over; the cover still renders fine.
    console.warn('bundled fonts did not load', e);
  }
}

function sizeOf() {
  return SIZES[doc.size] || SIZES.wide;
}

function repaint() {
  const { w, h } = sizeOf();
  if (stage.width !== w || stage.height !== h) {
    stage.width = w;
    stage.height = h;
  }
  paintPoster(sctx, doc, w, h);
  syncRail();
}

function savePrefs() {
  store('layout', doc.layout);
  store('title', doc.title);
  store('script', doc.script);
  store('tagline', doc.tagline);
  store('size', doc.size);
}

// ---- the rail (right-hand controls) --------------------------------------

function syncRail() {
  const count = panelCount(doc.layout);
  document.querySelectorAll('#panelSeg .seg-btn').forEach((btn, i) => {
    btn.hidden = i >= count;
    btn.classList.toggle('is-active', i === active);
  });
  const slot = doc.panels[active];
  $('scaleRange').value = slot.scale;
  $('scaleVal').textContent = `${Math.round(slot.scale * 100)}%`;
  $('mirrorBtn').classList.toggle('is-on', !!slot.mirror);
  const pick = $('photoPick');
  pick.innerHTML = '<option value="">— empty —</option>' + library.map((ph, i) =>
    `<option value="${i}">${ph.name}</option>`).join('');
  const idx = slot.img ? library.findIndex((ph) => ph.img === slot.img) : -1;
  pick.value = idx >= 0 ? String(idx) : '';
  document.querySelectorAll('[data-layout]').forEach((b) =>
    b.classList.toggle('is-active', b.dataset.layout === doc.layout));
  document.querySelectorAll('[data-size]').forEach((b) =>
    b.classList.toggle('is-active', b.dataset.size === doc.size));
}

function assignPhoto(panelIdx, photoIdx) {
  doc.panels[panelIdx].img = photoIdx === '' ? null : library[Number(photoIdx)].img;
  Object.assign(doc.panels[panelIdx], { scale: 1, dx: 0, dy: 0 });
  repaint();
}

// One delegated handler for every button and select in the rail.
$('rail').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.layout) {
    doc.layout = btn.dataset.layout;
    if (active >= panelCount(doc.layout)) active = 0;
    savePrefs();
    repaint();
  } else if (btn.dataset.size) {
    doc.size = btn.dataset.size;
    savePrefs();
    repaint();
  } else if (btn.dataset.panel !== undefined) {
    active = Number(btn.dataset.panel);
    syncRail();
  } else if (btn.id === 'mirrorBtn') {
    doc.panels[active].mirror = !doc.panels[active].mirror;
    repaint();
  } else if (btn.id === 'resetBtn') {
    Object.assign(doc.panels[active], { scale: 1, dx: 0, dy: 0, mirror: false });
    repaint();
  } else if (btn.id === 'exportBtn') {
    downloadPng();
  } else if (btn.dataset.sample !== undefined) {
    assignPhoto(active, btn.dataset.sample);
  }
});
$('rail').addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'photoPick') assignPhoto(active, t.value);
  else if (t.id === 'scaleRange') { doc.panels[active].scale = Number(t.value); repaint(); }
  else if (t.id === 'titleInput') { doc.title = t.value; savePrefs(); repaint(); }
  else if (t.id === 'scriptInput') { doc.script = t.value; savePrefs(); repaint(); }
  else if (t.id === 'taglineInput') { doc.tagline = t.value; savePrefs(); repaint(); }
});

// Drag on the stage to pan the active panel's photo; click picks a panel.
let drag = null;

function hitPanel(clientX, clientY) {
  const r = stage.getBoundingClientRect();
  const px = ((clientX - r.left) / r.width) * stage.width;
  const py = ((clientY - r.top) / r.height) * stage.height;
  const rects = panelRects(doc.layout, stage.width, stage.height);
  const i = rects.findIndex((rc) =>
    px >= rc.x && px <= rc.x + rc.w && py >= rc.y && py <= rc.y + rc.h);
  return { i, rect: r };
}

stage.addEventListener('pointerdown', (e) => {
  const hit = hitPanel(e.clientX, e.clientY);
  if (hit.i < 0) return;
  active = hit.i;
  syncRail();
  stage.setPointerCapture(e.pointerId);
  const slot = doc.panels[hit.i];
  drag = { x: e.clientX, y: e.clientY, dx: slot.dx, dy: slot.dy, rect: hit.rect };
});
stage.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const slot = doc.panels[active];
  if (!slot.img) return;
  const rects = panelRects(doc.layout, stage.width, stage.height);
  const rc = rects[active];
  const iw = slot.img.naturalWidth;
  const ih = slot.img.naturalHeight;
  const scale = Math.max(rc.w / iw, rc.h / ih) * slot.scale;
  const maxDx = Math.max(1, (iw * scale - rc.w) / 2);
  const maxDy = Math.max(1, (ih * scale - rc.h) / 2);
  const mx = ((e.clientX - drag.x) / drag.rect.width) * stage.width;
  const my = ((e.clientY - drag.y) / drag.rect.height) * stage.height;
  slot.dx = Math.max(-1, Math.min(1, drag.dx + mx / maxDx));
  slot.dy = Math.max(-1, Math.min(1, drag.dy + my / maxDy));
  repaint();
});
stage.addEventListener('pointerup', () => { drag = null; });

// ---- photos ---------------------------------------------------------------

async function addUpload(file) {
  const url = URL.createObjectURL(file);
  const img = await loadImage(url);
  library.push({ name: file.name, url, img });
  $('note').textContent = `Added ${file.name} — pick it for a panel below.`;
  // A first user photo fills the first empty panel on its own.
  const empty = doc.panels.findIndex((p, i) => i < panelCount(doc.layout) && !p.img);
  if (empty >= 0) doc.panels[empty].img = img;
  repaint();
}
$('photoInput').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    try { await addUpload(file); } catch { $('note').textContent = `Could not read ${file.name}.`; }
  }
  e.target.value = '';
});

// ---- export ---------------------------------------------------------------

function downloadPng() {
  const { w, h } = sizeOf();
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  paintPoster(off.getContext('2d'), doc, w, h);
  off.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-city-cover-${w}x${h}.png`;
    a.click();
    $('note').textContent = `Saved vice-city-cover-${w}x${h}.png`;
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}

// Ctrl/Cmd+S exports too, for a quick keyboard flow. Keys 1–3 switch
// the layout without reaching for the mouse.
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    downloadPng();
    return;
  }
  if (e.target.matches('input, select, textarea')) return;
  const idx = ['1', '2', '3'].indexOf(e.key);
  if (idx >= 0 && LAYOUT_NAMES[idx]) {
    doc.layout = LAYOUT_NAMES[idx];
    if (active >= panelCount(doc.layout)) active = 0;
    savePrefs();
    repaint();
  }
});

// ---- boot -----------------------------------------------------------------

async function boot() {
  $('titleInput').value = doc.title;
  $('scriptInput').value = doc.script;
  $('taglineInput').value = doc.tagline;
  for (const s of SAMPLES) {
    try {
      const img = await loadImage(s.url);
      library.push({ name: s.name, url: s.url, img });
    } catch { /* a missing sample just leaves panels empty */ }
  }
  // Default scene: pier fishing in the tall cinema panel, boulevard
  // sunset in the right-hand stack, plus a close crop for the last slot.
  if (library[0]) {
    doc.panels[0].img = library[0].img;
    doc.panels[0].dy = 0.4;
    doc.panels[2].img = library[0].img;
    doc.panels[2].scale = 1.6;
    doc.panels[2].dx = 0.25;
    doc.panels[2].dy = -0.4;
    doc.panels[3].img = library[0].img;
    doc.panels[3].scale = 1.4;
    doc.panels[3].dy = -0.2;
  }
  if (library[1]) {
    doc.panels[1].img = library[1].img;
    doc.panels[1].scale = 1.15;
    doc.panels[1].dy = 0.55;
  }
  const params = new URLSearchParams(location.search);
  const scene = params.get('scene');
  await loadFonts();
  if (scene) {
    await runScene(scene, params, { doc, library, repaint, loadImage, SIZES, sizeOf });
  } else {
    repaint();
  }
  window.__appReady = true;
}

boot();
