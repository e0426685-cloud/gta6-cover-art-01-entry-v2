// Fixed scenes for screenshots. `?scene=editor` shows the editor with
// the sample photos loaded; `?scene=cover` shows the finished cover
// alone, at the size the export would be — the app's own drawing, at
// screenshot size. window.__sceneReady is set once the fonts are in and
// the cover is painted.
import { panelCount } from './poster.js';

/** Pan/zoom presets per layout, keyed by panel index. */
const SHOT_CROPS = {
  cinema: [
    { ox: 0, oy: -0.3, zoom: 1.05 },
    { ox: 0, oy: -0.4, zoom: 1.1 },
    // The boulevard woman's face sits high and right in the photo, so
    // the close crop for the small panel pans up there, not to the torso.
    { ox: 0.1, oy: -0.45, zoom: 1.25 },
  ],
  mosaic: [
    // The pier man's face sits high in the photo: pan DOWN (positive
    // oy) so the top of the photo, not the torso, fills the wide band.
    { ox: 0, oy: 0.35, zoom: 1.0 },
    { ox: 0, oy: -0.3, zoom: 1.2 },
    { ox: -0.1, oy: 0.1, zoom: 1.35 },
    { ox: 0.1, oy: -0.2, zoom: 1.2 },
  ],
  triptych: [
    // Tall narrow panels: keep the zoom low so the whole photo height
    // fits, and pan down a touch so the faces sit inside the frame.
    { ox: 0, oy: 0.3, zoom: 1.05 },
    { ox: 0, oy: -0.4, zoom: 1.15 },
    { ox: 0.2, oy: 0.3, zoom: 1.05 },
  ],
};

/**
 * Pose a scene: apply the query overrides (layout, caption text,
 * export size), fill the panels with the sample photos, then paint.
 * `state` is the editor state object from app.js.
 */
export async function runScene(scene, query, state) {
  const { poster, library } = state;
  const find = (name) => library.find((p) => p.url.includes(name))?.img || null;
  const boulevard = find('boulevard');
  const pier = find('pier');

  // Query overrides: layout, caption text and export size.
  const layout = query.get('layout');
  if (layout) poster.layout = layout;
  if (query.get('title') !== null) poster.title = query.get('title');
  if (query.get('script') !== null) poster.script = query.get('script');
  if (query.get('tagline') !== null) poster.tagline = query.get('tagline');
  if (query.get('size')) poster.size = query.get('size');

  // Panel photos per scene. Cinema: pier fishing in the tall hero panel,
  // boulevard sunset in the right-hand stack. Mosaic and triptych
  // alternate the two samples with close crops.
  const crops = SHOT_CROPS[poster.layout] || SHOT_CROPS.cinema;
  const fill = (i, img) => {
    const slot = poster.panels[i];
    slot.img = img;
    const crop = crops[i] || { ox: 0, oy: 0, zoom: 1 };
    slot.ox = crop.ox; slot.oy = crop.oy; slot.zoom = crop.zoom;
    slot.flip = false;
  };
  if (poster.layout === 'mosaic') {
    fill(0, pier);
    fill(1, boulevard);
    fill(2, pier);
    fill(3, boulevard);
  } else if (poster.layout === 'triptych') {
    fill(0, pier);
    fill(1, boulevard);
    fill(2, pier);
  } else {
    fill(0, pier);
    fill(1, boulevard);
    fill(2, boulevard);
  }
  // Hide panels beyond the layout's count.
  for (let i = panelCount(poster.layout); i < poster.panels.length; i++) {
    poster.panels[i].img = null;
  }

  // In cover mode the editor chrome hides, leaving only the poster.
  if (scene === 'cover') document.body.classList.add('scene-cover');
  // repaint lives on the state object only in the editor module; the
  // scene repaints through the exported helper below.
  repaintPoster(state);
  await document.fonts.ready;
  repaintPoster(state); // paint once more now the bundled fonts are really in
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__sceneReady = true;
  window.__sceneName = scene;
}

// The editor module registers its repaint here so scenes can paint
// without importing the whole editor.
let repaintPoster = () => {};
export function registerRepaint(fn) {
  repaintPoster = fn;
}
