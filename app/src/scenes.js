// Fixed scenes for screenshots. `?scene=editor` shows the editor with
// the sample photos loaded; `?scene=cover` shows the finished cover
// alone, at the size the export would be — the app's own drawing, at
// screenshot size. window.__sceneReady is set once the fonts are in and
// the cover is painted.
import { panelCount } from './layouts.js';

export async function runScene(scene, query, app) {
  const { doc, library, repaint } = app;
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
  const P = doc.panels;
  const clear = () => P.forEach((p) => {
    p.scale = 1; p.dx = 0; p.dy = 0; p.mirror = false;
  });
  clear();
  if (doc.layout === 'mosaic') {
    P[0].img = boulevard; P[0].dy = 0.55;
    P[1].img = pier; P[1].scale = 1.2; P[1].dy = 0.5;
    P[2].img = boulevard; P[2].scale = 1.35; P[2].dx = 0.15; P[2].dy = -0.1;
    P[3].img = pier; P[3].scale = 1.2; P[3].dx = -0.1; P[3].dy = 0.35;
  } else if (doc.layout === 'triptych') {
    P[0].img = boulevard; P[0].scale = 1.3; P[0].dy = 0.5;
    P[1].img = pier; P[1].scale = 1.15; P[1].dy = 0.55;
    // Frame the boulevard woman's face: she stands on the photo's
    // right, face high, so pan the image left (dx negative) and up.
    P[2].img = boulevard; P[2].scale = 1.5; P[2].dx = -0.4; P[2].dy = 0.5;
  } else {
    P[0].img = pier; P[0].scale = 1.05; P[0].dy = 0.4;
    P[1].img = boulevard; P[1].scale = 1.1; P[1].dy = 0.5;
    P[2].img = boulevard; P[2].scale = 1.6; P[2].dx = 0.25; P[2].dy = -0.4;
  }
  // Hide panels beyond the layout's count.
  for (let i = panelCount(doc.layout); i < P.length; i++) P[i].img = null;

  // In cover mode the editor chrome hides, leaving only the poster.
  if (scene === 'cover') document.body.classList.add('scene-cover');
  repaint();
  await document.fonts.ready;
  repaint(); // paint once more now the bundled fonts are really in
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__sceneReady = true;
}
