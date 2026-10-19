# Uniform Visualiser

A character-creator-style app that shows how to place badges on a Singapore Army uniform. It is
data-driven: the uniform, the anchor points, the badge catalogue and the placement rules are all JSON,
so adding a badge or a uniform never needs UI code. Web first (Vite + React + TypeScript), then wrapped
for iOS and Android with Capacitor.

Read `docs/PLAN.md` for the roadmap and open questions, `docs/STYLE.md` before drawing any art, and
`docs/ADDING_BADGES.md` before touching badge data.

## Commands

- `npm run dev` start the dev server
- `npm run build` typecheck + production build
- `npm test` unit tests (placement rules and layout)
- `npm run data:validate` check every JSON file and the art on disk (run before finishing any data change)
- `npm run data:sync` same, and flips a badge from `todo` to `redrawn` when its PNG exists
- `npm run refs:fetch` download the official reference photos (needs Python; run on the user's computer)

## Layout

- `src/data/` all content: `categories.json`, `badges.json`, `uniforms/<id>.json`, `schema.ts` (zod)
- `src/lib/placement.ts` pure rules and layout. Add rules here, with tests in `placement.test.ts`
- `src/components/` UI only. No rules or content in components
- `public/uniforms/` uniform art, `public/badges/<category>/<slug>.png` redrawn badge art
- `reference/` official photos manifest (inputs for redrawing). Downloaded images are git-ignored
- `reference/samples/` the user's own Nano Banana uniform samples (Number 1, 3, 5) and screenshots of the
  Uniformity app that inspired the library and placement-guide screens
- `scripts/` data validation and the reference downloader

## Conventions

- A badge is identified by `category/slug`. Its art path is always `public/badges/<category>/<slug>.png`.
- Coordinates are in uniform image pixels (see `width`/`height` in the uniform JSON), never screen pixels.
- Only state a placement rule or limit that a source states. The source for the current rules is
  https://www.army.gov.sg/our-forces/badges/. Anything guessed (anchor positions, `widthMm`) must keep
  `verified: false` / `sizeVerified: false` until checked against the dress regulations.
- Do not ship or commit the official reference photos. Redrawn art only.
- Keep the app working offline and from `file://` (Capacitor): use `assetUrl()` for files under `public/`,
  no absolute `/paths`, no network calls at runtime.
- Wrap `localStorage` access in try/catch. It can be unavailable.
- Mobile first: layouts must work at 390px wide, tap targets at least 40px.
- TypeScript strict. Run `npm run typecheck`, `npm test` and `npm run data:validate` before saying a task is done.

## Current state

Working slice: Number 1 uniform, click-to-place, placement rules (max 2 proficiency badges, no spot for
formation badges because the source does not say where they go), anchor overlay, size slider, saved state.
All 75 badges are catalogued. The 3 proficiency badges have draft redrawn art; the other 72 show a
placeholder tile. `scripts/process_badge.py` turns a generated image into app-ready art.
