// Fixed scenes for screenshots. `?scene=editor` shows the editor with
// the sample photos loaded; `?scene=cover` shows the finished cover
// alone, at the size the export would be — the app's own drawing, at
// screenshot size. window.__sceneReady is set once the fonts are in and
// the cover is painted.
import { panelCount } from './cover.js';

/** Focal-point presets per layout, keyed by panel index. */
const SCENE_CROPS = {
  cinema: [
    { fx: 0.5, fy: 0.4, zoom: 1.05 },
    { fx: 0.5, fy: 0.3, zoom: 1.1 },
    { fx: 0.4, fy: 0.6, zoom: 1.6 },
  ],
  mosaic: [
    { fx: 0.5, fy: 0.3, zoom: 1.0 },
    { fx: 0.5, fy: 0.35, zoom: 1.2 },
    { fx: 0.45, fy: 0.55, zoom: 1.35 },
    { fx: 0.55, fy: 0.4, zoom: 1.2 },
  ],
  triptych: [
    { fx: 0.5, fy: 0.35, zoom: 1.3 },
    { fx: 0.5, fy: 0.3, zoom: 1.15 },
    { fx: 0.6, fy: 0.35, zoom: 1.5 },
  ],
};

export async function runShot(scene, query, editor) {
  const { doc, library } = editor;
  const find = (name) => library.find((p) => p.url.includes(name))?.img || null;
  const boulevard = find('boulevard');
  const pier = find('pier');

  // Query overrides: layout, caption text and export size.
  const layout = query.get('layout');
  if (layout) doc.layout = layout;
  if (query.get('title') !== null) doc.title = query.get('title');
  if (query.get('script') !== null) doc.script = query.get('script');
  if (query.get('tagline') !== null) doc.tagline = query.get('tagline');
  if (query.get('size')) doc.size = query.get('size');

  // Panel photos per scene. Cinema: pier fishing in the tall hero panel,
  // boulevard sunset in the right-hand stack. Mosaic and triptych
  // alternate the two samples with close crops.
  const crops = SCENE_CROPS[doc.layout] || SCENE_CROPS.cinema;
  const assign = (i, img) => {
    const slot = doc.panels[i];
    slot.img = img;
    const crop = crops[i] || { fx: 0.5, fy: 0.5, zoom: 1 };
    slot.fx = crop.fx; slot.fy = crop.fy; slot.zoom = crop.zoom;
    slot.flip = false;
  };
  if (doc.layout === 'mosaic') {
    assign(0, boulevard);
    assign(1, pier);
    assign(2, boulevard);
    assign(3, pier);
  } else if (doc.layout === 'triptych') {
    assign(0, boulevard);
    assign(1, pier);
    assign(2, boulevard);
  } else {
    assign(0, pier);
    assign(1, boulevard);
    assign(2, boulevard);
  }
  // Hide panels beyond the layout's count.
  for (let i = panelCount(doc.layout); i < doc.panels.length; i++) {
    doc.panels[i].img = null;
  }

  // In cover mode the editor chrome hides, leaving only the poster.
  if (scene === 'cover') document.body.classList.add('scene-cover');
  editor.repaint();
  await document.fonts.ready;
  editor.repaint(); // paint once more now the bundled fonts are really in
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__sceneReady = true;
}
