// Vice Cover Studio — editor wiring, round 6. A `?scene=` query sets up
// a fixed scene for a screenshot (see scenes.js).
//
// The editor is plain functions over one `state` object — no class, no
// delegation: every control gets its own listener, wired once at boot.
import { paintPoster, panelCount, layoutRects, LAYOUT_NAMES } from './poster.js';
import { runScene, registerRepaint } from './scenes.js';

/** Export sizes, in pixels. */
const EXPORT_SIZES = {
  square: { w: 1080, h: 1080, label: '1080 × 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 × 1350' },
  wide: { w: 1920, h: 1080, label: '1920 × 1080' },
};

/** Built-in sample photos shipped with the app. */
const SAMPLE_PHOTOS = [
  { name: 'Pier — fishing at noon', url: 'samples/pier.jpg' },
  { name: 'Boulevard — sunset convertible', url: 'samples/boulevard.jpg' },
];

const PREF = 'vcs6';

function readPref(key, fallback) {
  try { return localStorage.getItem(`${PREF}-${key}`) ?? fallback; } catch { return fallback; }
}
function writePref(key, value) {
  try { localStorage.setItem(`${PREF}-${key}`, value); } catch { /* private mode */ }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** One panel slot: a photo plus its crop (pan offset + zoom + flip). */
function emptySlot() {
  return { img: null, zoom: 1, ox: 0, oy: 0, flip: false };
}

const state = {
  poster: {
    layout: readPref('layout', 'cinema'),
    title: readPref('title', 'Neon Palms'),
    script: readPref('script', 'Welcome to Leonida'),
    tagline: readPref('tagline', 'A Leonida story'),
    size: readPref('size', 'wide'),
    panels: [emptySlot(), emptySlot(), emptySlot(), emptySlot()],
  },
  library: [], // { name, url, img } — samples plus the user's uploads
  active: 0, // which panel the controls edit right now
  drag: null,
};

function $(id) {
  return document.getElementById(id);
}

function sizeOf() {
  return EXPORT_SIZES[state.poster.size] || EXPORT_SIZES.wide;
}

function repaint() {
  const stage = $('stage');
  const { w, h } = sizeOf();
  if (stage.width !== w || stage.height !== h) {
    stage.width = w;
    stage.height = h;
  }
  paintPoster(stage.getContext('2d'), state.poster, w, h);
  syncPanelControls();
}

function savePrefs() {
  writePref('layout', state.poster.layout);
  writePref('title', state.poster.title);
  writePref('script', state.poster.script);
  writePref('tagline', state.poster.tagline);
  writePref('size', state.poster.size);
}

function syncPanelControls() {
  const count = panelCount(state.poster.layout);
  document.querySelectorAll('#panelBar .chip').forEach((btn, i) => {
    btn.hidden = i >= count;
    btn.classList.toggle('picked', i === state.active);
  });
  const slot = state.poster.panels[state.active];
  $('zoomSlider').value = slot.zoom;
  $('zoomValue').textContent = `${Math.round(slot.zoom * 100)}%`;
  $('flipButton').classList.toggle('on', !!slot.flip);
  const pick = $('photoPicker');
  pick.innerHTML = '<option value="">— empty —</option>' + state.library.map((ph, i) =>
    `<option value="${i}">${ph.name}</option>`).join('');
  const idx = slot.img ? state.library.findIndex((ph) => ph.img === slot.img) : -1;
  pick.value = idx >= 0 ? String(idx) : '';
  document.querySelectorAll('[data-layout]').forEach((b) =>
    b.classList.toggle('picked', b.dataset.layout === state.poster.layout));
  document.querySelectorAll('[data-size]').forEach((b) =>
    b.classList.toggle('picked', b.dataset.size === state.poster.size));
}

function setPanelPhoto(panelIdx, photoIdx) {
  const slot = state.poster.panels[panelIdx];
  slot.img = photoIdx === '' ? null : state.library[Number(photoIdx)].img;
  slot.zoom = 1; slot.ox = 0; slot.oy = 0; slot.flip = false;
  repaint();
}

function note(text) {
  $('statusText').textContent = text;
}

/** Which panel is under a pointer event, in canvas pixels. */
function panelAt(clientX, clientY) {
  const stage = $('stage');
  const r = stage.getBoundingClientRect();
  const px = ((clientX - r.left) / r.width) * stage.width;
  const py = ((clientY - r.top) / r.height) * stage.height;
  const rects = layoutRects(state.poster.layout, stage.width, stage.height);
  const i = rects.findIndex((rc) =>
    px >= rc.x && px <= rc.x + rc.w && py >= rc.y && py <= rc.y + rc.h);
  return { i, rect: r };
}

async function addUpload(file) {
  const url = URL.createObjectURL(file);
  const img = await loadImage(url);
  state.library.push({ name: file.name, url, img });
  note(`Added ${file.name} — pick it for a panel below.`);
  // A first user photo fills the first empty panel on its own.
  const empty = state.poster.panels.findIndex((p, i) => i < panelCount(state.poster.layout) && !p.img);
  if (empty >= 0) state.poster.panels[empty].img = img;
  repaint();
}

function exportPng() {
  const { w, h } = sizeOf();
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  paintPoster(off.getContext('2d'), state.poster, w, h);
  off.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-city-cover-${w}x${h}.png`;
    a.click();
    note(`Saved vice-city-cover-${w}x${h}.png`);
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}

function wireControls() {
  // Layout + size chips.
  document.querySelectorAll('[data-layout]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.poster.layout = btn.dataset.layout;
      if (state.active >= panelCount(state.poster.layout)) state.active = 0;
      savePrefs();
      repaint();
    });
  });
  document.querySelectorAll('[data-size]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.poster.size = btn.dataset.size;
      savePrefs();
      repaint();
    });
  });
  // Panel picker chips.
  document.querySelectorAll('#panelBar .chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.active = Number(btn.dataset.panel);
      syncPanelControls();
    });
  });
  // Sample photo buttons.
  document.querySelectorAll('[data-sample]').forEach((btn) => {
    btn.addEventListener('click', () => setPanelPhoto(state.active, btn.dataset.sample));
  });
  // Panel tools.
  $('flipButton').addEventListener('click', () => {
    state.poster.panels[state.active].flip = !state.poster.panels[state.active].flip;
    repaint();
  });
  $('resetCropBtn').addEventListener('click', () => {
    Object.assign(state.poster.panels[state.active], { zoom: 1, ox: 0, oy: 0, flip: false });
    repaint();
  });
  $('exportBtn').addEventListener('click', exportPng);
  // Live inputs.
  $('photoPicker').addEventListener('input', (e) => setPanelPhoto(state.active, e.target.value));
  $('zoomSlider').addEventListener('input', (e) => {
    state.poster.panels[state.active].zoom = Number(e.target.value);
    repaint();
  });
  $('titleInput').addEventListener('input', (e) => {
    state.poster.title = e.target.value; savePrefs(); repaint();
  });
  $('scriptInput').addEventListener('input', (e) => {
    state.poster.script = e.target.value; savePrefs(); repaint();
  });
  $('taglineInput').addEventListener('input', (e) => {
    state.poster.tagline = e.target.value; savePrefs(); repaint();
  });
  $('fileInput').addEventListener('change', async (e) => {
    for (const file of e.target.files) {
      try { await addUpload(file); } catch { note(`Could not read ${file.name}.`); }
    }
    e.target.value = '';
  });

  // Drag on the stage to pan the photo; click picks a panel.
  const stage = $('stage');
  stage.addEventListener('pointerdown', (e) => {
    const hit = panelAt(e.clientX, e.clientY);
    if (hit.i < 0) return;
    state.active = hit.i;
    syncPanelControls();
    stage.setPointerCapture(e.pointerId);
    const slot = state.poster.panels[hit.i];
    state.drag = { x: e.clientX, y: e.clientY, ox: slot.ox, oy: slot.oy, rect: hit.rect };
  });
  stage.addEventListener('pointermove', (e) => {
    if (!state.drag) return;
    const slot = state.poster.panels[state.active];
    if (!slot.img) return;
    const rects = layoutRects(state.poster.layout, stage.width, stage.height);
    const rc = rects[state.active];
    const iw = slot.img.naturalWidth;
    const ih = slot.img.naturalHeight;
    const scale = Math.max(rc.w / iw, rc.h / ih) * slot.zoom;
    // The pan offset moves with the drag, in photo fractions.
    const dx = ((e.clientX - state.drag.x) / state.drag.rect.width) * stage.width;
    const dy = ((e.clientY - state.drag.y) / state.drag.rect.height) * stage.height;
    const rangeX = Math.max(1, (iw * scale - rc.w) / 2);
    const rangeY = Math.max(1, (ih * scale - rc.h) / 2);
    slot.ox = Math.max(-1, Math.min(1, state.drag.ox + dx / rangeX));
    slot.oy = Math.max(-1, Math.min(1, state.drag.oy + dy / rangeY));
    repaint();
  });
  stage.addEventListener('pointerup', () => { state.drag = null; });
  stage.addEventListener('pointercancel', () => { state.drag = null; });

  // Ctrl/Cmd+S exports too. Keys 1–3 switch the layout; arrows nudge
  // the active panel's crop by a small step.
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      exportPng();
      return;
    }
    if (e.target.matches('input, select, textarea')) return;
    const idx = ['1', '2', '3'].indexOf(e.key);
    if (idx >= 0 && LAYOUT_NAMES[idx]) {
      state.poster.layout = LAYOUT_NAMES[idx];
      if (state.active >= panelCount(state.poster.layout)) state.active = 0;
      savePrefs();
      repaint();
      return;
    }
    const slot = state.poster.panels[state.active];
    const step = 0.05;
    if (e.key === 'ArrowLeft') slot.ox = Math.max(-1, slot.ox - step);
    else if (e.key === 'ArrowRight') slot.ox = Math.min(1, slot.ox + step);
    else if (e.key === 'ArrowUp') slot.oy = Math.max(-1, slot.oy - step);
    else if (e.key === 'ArrowDown') slot.oy = Math.min(1, slot.oy + step);
    else return;
    e.preventDefault();
    repaint();
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

async function boot() {
  $('titleInput').value = state.poster.title;
  $('scriptInput').value = state.poster.script;
  $('taglineInput').value = state.poster.tagline;
  wireControls();
  for (const s of SAMPLE_PHOTOS) {
    try {
      const img = await loadImage(s.url);
      state.library.push({ name: s.name, url: s.url, img });
    } catch { /* a missing sample just leaves panels empty */ }
  }
  // Default scene: pier fishing in the tall cinema panel, boulevard
  // sunset in the right-hand stack, plus a close crop for the last slot.
  const [pier, boulevard] = [state.library[0], state.library[1]];
  if (pier) {
    state.poster.panels[0].img = pier.img; state.poster.panels[0].oy = -0.3;
    state.poster.panels[2].img = pier.img; state.poster.panels[2].zoom = 1.6;
    state.poster.panels[2].ox = -0.2; state.poster.panels[2].oy = 0.2;
    state.poster.panels[3].img = pier.img; state.poster.panels[3].zoom = 1.4;
    state.poster.panels[3].oy = 0.2;
  }
  if (boulevard) {
    state.poster.panels[1].img = boulevard.img; state.poster.panels[1].zoom = 1.15;
    state.poster.panels[1].oy = -0.4;
  }
  const params = new URLSearchParams(location.search);
  const scene = params.get('scene');
  await loadFonts();
  registerRepaint(repaint); // scenes paint through the editor's repaint
  if (scene) {
    await runScene(scene, params, state);
  } else {
    repaint();
  }
  window.__appReady = true;
}

boot();
