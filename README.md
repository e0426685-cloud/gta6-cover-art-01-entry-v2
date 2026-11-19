# gta6-cover-art-01-entry-v2

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/e0426685-cloud/gta6-cover-art-01-entry-v2/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/e0426685-cloud/gta6-cover-art-01-entry-v2/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

**Vice Cover Studio** — an offline browser app that turns your own photos into GTA 6-style cover art: a multi-panel comic poster with a Vice City sunset/neon grade and a halftone print screen, a bold Anton block-letter title, a glowing Pacifico neon script line, and a gold-ruled tagline strip. Pick a layout (cinema, mosaic, or triptych), crop and position each photo per panel, write the caption, and export a PNG in 1080 × 1080, 1080 × 1350, or 1920 × 1080. Photos never leave your device.

## Try it

```sh
node serve.ts   # then open http://localhost:8080
```

Or open `app/index.html` directly from disk — the app is plain static files with no build step and makes no network requests. The two sample photos in `app/samples/` were made with an image model for this project; the fonts in `app/fonts/` (Anton, Pacifico) are under the SIL Open Font License, see `app/fonts/OFL.txt`. No Rockstar artwork, logo, or font is used.

## How it works

- `app/src/cover.js` — the whole renderer: `renderCover(ctx, doc, W, H)` splits the poster into panel rectangles, paints each photo around its focal point, runs the grade pipeline (sunset wash, halftone dot screen, inner glow, seeded grain), frames the panels, and draws the caption band. The same function draws the live preview and the exported PNG, so the download is exactly what you see.
- `app/src/editor.js` — the `CoverEditor` class: document state, photo uploads, drag-to-move focal points, layout/size pickers, PNG export, and keyboard shortcuts.
- `app/src/shots.js` — fixed scenes for screenshots: the same cover, posed three ways.
- `main.ts` — copies `app/` + `screenshots/` to `/output` and writes `/output/dossier.json` via the vendored make.fun library.

## Layouts

- **Cinema** — one tall hero panel on the left, two stacked panels on the right.
- **Mosaic** — a wide band on top, three small panels sharing the bottom strip.
- **Triptych** — three columns, the middle one wider than its neighbours.

## Run it (grader entry point)

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts && ls -l out
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=52532a96&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
