// Fixed scenes for screenshots. `?shot=editor` shows the editor with the
// sample photos loaded; `?shot=cover` shows the finished cover alone, at the
// size the export would be — the app's own drawing, at screenshot size.
// window.__shotReady is set once the fonts are in and the cover is painted.
export async function runShot(shot, query, app) {
  const { state, photos, redraw, SIZES } = app;
  const pick = (name) => photos.find((p) => p.url.includes(name))?.img || null;
  const boulevard = pick('boulevard');
  const pier = pick('pier');

  // Query overrides: layout, caption text and export size.
  if (query.get('layout')) state.layout = query.get('layout');
  if (query.get('title') !== null) state.title = query.get('title');
  if (query.get('subtitle') !== null) state.subtitle = query.get('subtitle');
  if (query.get('tagline') !== null) state.tagline = query.get('tagline');
  if (query.get('size') && SIZES[query.get('size')]) state.size = query.get('size');

  // Panel photos per scene. Hero: boulevard sunset on top, pier plus a
  // close crop of the boulevard car in the strip. Grid and columns
  // alternate the two samples.
  const P = state.panels;
  const reset = () => P.forEach((p) => { p.zoom = 1; p.ox = 0; p.oy = 0; p.flip = false; });
  reset();
  if (state.layout === 'grid') {
    P[0].photo = boulevard; P[0].zoom = 1.1; P[0].oy = 0.5;
    P[1].photo = pier; P[1].zoom = 1.2; P[1].oy = 0.5;
    P[2].photo = pier; P[2].zoom = 1.5; P[2].ox = 0.2; P[2].oy = 0;
    P[3].photo = boulevard; P[3].zoom = 1.6; P[3].ox = 0.45; P[3].oy = -0.25;
  } else if (state.layout === 'columns') {
    P[0].photo = pier; P[0].zoom = 1.3; P[0].oy = 0.5;
    P[1].photo = boulevard; P[1].zoom = 1.1; P[1].oy = 0.55;
    P[2].photo = boulevard; P[2].zoom = 1.7; P[2].ox = 0.5; P[2].oy = -0.2;
  } else {
    P[0].photo = boulevard; P[0].oy = 0.55;
    P[1].photo = pier; P[1].zoom = 1.15; P[1].oy = 0.55;
    P[2].photo = boulevard; P[2].zoom = 1.6; P[2].ox = 0.25; P[2].oy = -0.4;
  }

  // In cover mode the editor chrome hides, leaving only the poster.
  if (shot === 'cover') document.body.classList.add('shot-cover');
  redraw();
  await document.fonts.ready;
  redraw(); // paint once more now the bundled fonts are really in
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
