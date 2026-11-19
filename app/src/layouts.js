// Panel geometry for Vice Cover Studio, round 4.
//
// A layout is a list of cells. Each cell is [x, y, w, h] in *weight*
// units: the solver below turns weights into pixel rectangles with a
// comic-book gutter between neighbours. Because the geometry comes from
// data, adding a layout means adding one array — no new code paths.
//
// The three layouts:
//   cinema   — one tall hero panel on the left, two stacked panels right
//   mosaic   — a wide band on top, three small panels sharing the bottom
//   triptych — three columns, the middle one half as wide again as its
//              neighbours

const GUTTER = 0.014; // gutter width as a fraction of the cover width

const CELLS = {
  cinema: [
    [0, 0, 64, 100],
    [64, 0, 36, 49],
    [64, 51, 36, 49],
  ],
  mosaic: [
    [0, 0, 100, 52],
    [0, 52, 33, 48],
    [33, 52, 34, 48],
    [67, 52, 33, 48],
  ],
  triptych: [
    [0, 0, 30, 100],
    [30, 0, 40, 100],
    [70, 0, 30, 100],
  ],
};

/** The layout names the editor offers, in display order. */
export const LAYOUT_NAMES = ['cinema', 'mosaic', 'triptych'];

/** How many panels a layout has. */
export function panelCount(layout) {
  return (CELLS[layout] || CELLS.cinema).length;
}

/**
 * Pixel rectangles for a layout. Every rectangle is inset by half a
 * gutter on each side so neighbouring panels are separated by a full
 * gutter of backing colour.
 */
export function panelRects(layout, W, H) {
  const cells = CELLS[layout] || CELLS.cinema;
  const g = Math.max(3, Math.round(W * GUTTER));
  const half = g / 2;
  return cells.map(([cx, cy, cw, ch]) => {
    const x = Math.round((cx / 100) * W + half);
    const y = Math.round((cy / 100) * H + half);
    const right = Math.round(((cx + cw) / 100) * W - half);
    const bottom = Math.round(((cy + ch) / 100) * H - half);
    // Never emit a degenerate rectangle, even for tiny covers.
    return {
      x, y,
      w: Math.max(1, right - x),
      h: Math.max(1, bottom - y),
    };
  });
}
