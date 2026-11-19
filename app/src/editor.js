// Vice Cover Studio — editor wiring, round 5. A `?scene=` query sets up
// a fixed scene for a screenshot (see shots.js).
import { renderCover, panelCount, layoutRects, LAYOUT_NAMES } from './cover.js';
import { runShot } from './shots.js';

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

const PREF = 'vcs5';

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

/** One panel slot: a photo plus its crop (focal point + zoom + flip). */
function emptySlot() {
  return { img: null, zoom: 1, fx: 0.5, fy: 0.5, flip: false };
}

export class CoverEditor {
  constructor() {
    this.stage = document.getElementById('stage');
    this.sctx = this.stage.getContext('2d');
    this.doc = {
      layout: readPref('layout', 'cinema'),
      title: readPref('title', 'Sunset Heist'),
      script: readPref('script', 'Welcome to Vice City'),
      tagline: readPref('tagline', 'A Vice City story'),
      size: readPref('size', 'wide'),
      panels: [emptySlot(), emptySlot(), emptySlot(), emptySlot()],
    };
    this.library = []; // { name, url, img } — samples plus the user's uploads
    this.active = 0; // which panel the controls edit right now
    this.drag = null;
    this.wireControls();
  }

  size() {
    return EXPORT_SIZES[this.doc.size] || EXPORT_SIZES.wide;
  }

  repaint() {
    const { w, h } = this.size();
    if (this.stage.width !== w || this.stage.height !== h) {
      this.stage.width = w;
      this.stage.height = h;
    }
    renderCover(this.sctx, this.doc, w, h);
    this.syncControls();
  }

  savePrefs() {
    writePref('layout', this.doc.layout);
    writePref('title', this.doc.title);
    writePref('script', this.doc.script);
    writePref('tagline', this.doc.tagline);
    writePref('size', this.doc.size);
  }

  // ---- controls -----------------------------------------------------------

  el(id) {
    return document.getElementById(id);
  }

  syncControls() {
    const count = panelCount(this.doc.layout);
    document.querySelectorAll('#panelPicker .chip').forEach((btn, i) => {
      btn.hidden = i >= count;
      btn.classList.toggle('picked', i === this.active);
    });
    const slot = this.doc.panels[this.active];
    this.el('zoomRange').value = slot.zoom;
    this.el('zoomLabel').textContent = `${Math.round(slot.zoom * 100)}%`;
    this.el('flipBtn').classList.toggle('on', !!slot.flip);
    const pick = this.el('photoSelect');
    pick.innerHTML = '<option value="">— empty —</option>' + this.library.map((ph, i) =>
      `<option value="${i}">${ph.name}</option>`).join('');
    const idx = slot.img ? this.library.findIndex((ph) => ph.img === slot.img) : -1;
    pick.value = idx >= 0 ? String(idx) : '';
    document.querySelectorAll('[data-layout]').forEach((b) =>
      b.classList.toggle('picked', b.dataset.layout === this.doc.layout));
    document.querySelectorAll('[data-size]').forEach((b) =>
      b.classList.toggle('picked', b.dataset.size === this.doc.size));
  }

  pickPhoto(panelIdx, photoIdx) {
    const slot = this.doc.panels[panelIdx];
    slot.img = photoIdx === '' ? null : this.library[Number(photoIdx)].img;
    slot.zoom = 1; slot.fx = 0.5; slot.fy = 0.5; slot.flip = false;
    this.repaint();
  }

  wireControls() {
    const rail = this.el('controls');
    rail.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.layout) {
        this.doc.layout = btn.dataset.layout;
        if (this.active >= panelCount(this.doc.layout)) this.active = 0;
        this.savePrefs();
        this.repaint();
      } else if (btn.dataset.size) {
        this.doc.size = btn.dataset.size;
        this.savePrefs();
        this.repaint();
      } else if (btn.dataset.panel !== undefined) {
        this.active = Number(btn.dataset.panel);
        this.syncControls();
      } else if (btn.id === 'flipBtn') {
        this.doc.panels[this.active].flip = !this.doc.panels[this.active].flip;
        this.repaint();
      } else if (btn.id === 'cropResetBtn') {
        Object.assign(this.doc.panels[this.active], { zoom: 1, fx: 0.5, fy: 0.5, flip: false });
        this.repaint();
      } else if (btn.id === 'saveBtn') {
        this.exportPng();
      } else if (btn.dataset.sample !== undefined) {
        this.pickPhoto(this.active, btn.dataset.sample);
      }
    });
    rail.addEventListener('input', (e) => {
      const t = e.target;
      if (t.id === 'photoSelect') this.pickPhoto(this.active, t.value);
      else if (t.id === 'zoomRange') { this.doc.panels[this.active].zoom = Number(t.value); this.repaint(); }
      else if (t.id === 'titleField') { this.doc.title = t.value; this.savePrefs(); this.repaint(); }
      else if (t.id === 'scriptField') { this.doc.script = t.value; this.savePrefs(); this.repaint(); }
      else if (t.id === 'taglineField') { this.doc.tagline = t.value; this.savePrefs(); this.repaint(); }
    });

    // Drag on the stage to move the focal point; click picks a panel.
    this.stage.addEventListener('pointerdown', (e) => {
      const hit = this.panelAt(e.clientX, e.clientY);
      if (hit.i < 0) return;
      this.active = hit.i;
      this.syncControls();
      this.stage.setPointerCapture(e.pointerId);
      const slot = this.doc.panels[hit.i];
      this.drag = { x: e.clientX, y: e.clientY, fx: slot.fx, fy: slot.fy, rect: hit.rect };
    });
    this.stage.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      const slot = this.doc.panels[this.active];
      if (!slot.img) return;
      const rects = layoutRects(this.doc.layout, this.stage.width, this.stage.height);
      const rc = rects[this.active];
      const iw = slot.img.naturalWidth;
      const ih = slot.img.naturalHeight;
      const scale = Math.max(rc.w / iw, rc.h / ih) * slot.zoom;
      // The focal point moves opposite the drag, in photo fractions.
      const dx = ((e.clientX - this.drag.x) / this.drag.rect.width) * this.stage.width;
      const dy = ((e.clientY - this.drag.y) / this.drag.rect.height) * this.stage.height;
      slot.fx = Math.max(0, Math.min(1, this.drag.fx - dx / (iw * scale)));
      slot.fy = Math.max(0, Math.min(1, this.drag.fy - dy / (ih * scale)));
      this.repaint();
    });
    this.stage.addEventListener('pointerup', () => { this.drag = null; });

    this.el('uploadInput').addEventListener('change', async (e) => {
      for (const file of e.target.files) {
        try { await this.addUpload(file); } catch { this.note(`Could not read ${file.name}.`); }
      }
      e.target.value = '';
    });

    // Ctrl/Cmd+E exports too. Keys 1–3 switch the layout.
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        this.exportPng();
        return;
      }
      if (e.target.matches('input, select, textarea')) return;
      const idx = ['1', '2', '3'].indexOf(e.key);
      if (idx >= 0 && LAYOUT_NAMES[idx]) {
        this.doc.layout = LAYOUT_NAMES[idx];
        if (this.active >= panelCount(this.doc.layout)) this.active = 0;
        this.savePrefs();
        this.repaint();
      }
    });
  }

  /** Which panel is under a pointer event, in canvas pixels. */
  panelAt(clientX, clientY) {
    const r = this.stage.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * this.stage.width;
    const py = ((clientY - r.top) / r.height) * this.stage.height;
    const rects = layoutRects(this.doc.layout, this.stage.width, this.stage.height);
    const i = rects.findIndex((rc) =>
      px >= rc.x && px <= rc.x + rc.w && py >= rc.y && py <= rc.y + rc.h);
    return { i, rect: r };
  }

  async addUpload(file) {
    const url = URL.createObjectURL(file);
    const img = await loadImage(url);
    this.library.push({ name: file.name, url, img });
    this.note(`Added ${file.name} — pick it for a panel below.`);
    // A first user photo fills the first empty panel on its own.
    const empty = this.doc.panels.findIndex((p, i) => i < panelCount(this.doc.layout) && !p.img);
    if (empty >= 0) this.doc.panels[empty].img = img;
    this.repaint();
  }

  note(text) {
    this.el('statusLine').textContent = text;
  }

  // ---- export -------------------------------------------------------------

  exportPng() {
    const { w, h } = this.size();
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    renderCover(off.getContext('2d'), this.doc, w, h);
    off.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vice-city-cover-${w}x${h}.png`;
      a.click();
      this.note(`Saved vice-city-cover-${w}x${h}.png`);
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, 'image/png');
  }

  // ---- boot ---------------------------------------------------------------

  async boot() {
    this.el('titleField').value = this.doc.title;
    this.el('scriptField').value = this.doc.script;
    this.el('taglineField').value = this.doc.tagline;
    for (const s of SAMPLE_PHOTOS) {
      try {
        const img = await loadImage(s.url);
        this.library.push({ name: s.name, url: s.url, img });
      } catch { /* a missing sample just leaves panels empty */ }
    }
    // Default scene: pier fishing in the tall cinema panel, boulevard
    // sunset in the right-hand stack, plus a close crop for the last slot.
    const [pier, boulevard] = [this.library[0], this.library[1]];
    if (pier) {
      this.doc.panels[0].img = pier.img; this.doc.panels[0].fy = 0.35;
      this.doc.panels[2].img = pier.img; this.doc.panels[2].zoom = 1.6;
      this.doc.panels[2].fx = 0.4; this.doc.panels[2].fy = 0.6;
      this.doc.panels[3].img = pier.img; this.doc.panels[3].zoom = 1.4;
      this.doc.panels[3].fy = 0.6;
    }
    if (boulevard) {
      this.doc.panels[1].img = boulevard.img; this.doc.panels[1].zoom = 1.15;
      this.doc.panels[1].fy = 0.3;
    }
    const params = new URLSearchParams(location.search);
    const scene = params.get('scene');
    await this.loadFonts();
    if (scene) {
      await runShot(scene, params, this);
    } else {
      this.repaint();
    }
    window.__appReady = true;
  }

  async loadFonts() {
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
}

const editor = new CoverEditor();
editor.boot();
