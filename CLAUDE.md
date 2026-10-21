# Uniform Visualiser

A character-creator-style app that shows how to place badges on a Singapore Army uniform. It is
data-driven: the uniform, the anchor points, the badge catalogue and the placement rules are all JSON,
so adding a badge or a uniform never needs UI code. Web first (Vite + React + TypeScript), then wrapped
for iOS and Android with Capacitor.

This repo is **only the web app**. Making badge art (raw photos to flat art, perspective, vetting) is a
separate program, `badge-art-pipeline` (sibling folder), which hands this app a bundle that
`npm run art:import` brings in. Never add Python, image-model code or raw photos here.

Read `docs/PLAN.md` for the roadmap and open questions, `docs/ADDING_BADGES.md` before touching badge data,
and `docs/ART.md` for how art arrives from the pipeline.

## Commands

- `npm run dev` start the dev server
- `npm run build` typecheck + production build
- `npm test` unit tests (placement rules and layout)
- `npm run data:validate` check every JSON file and the art on disk (run before finishing any data change)
- `npm run data:sync` same, and flips a badge from `todo` to `redrawn` when its PNG exists
- `npm run art:import -- ../badge-art-pipeline/export/number-1` bring in a bundle of finished art and
  perspective sprites from the pipeline (`--dry` only checks it); run `data:validate` after

## Flow

The app opens on the selection screen (Service, Gender, Uniform, Rank, Branch; last choice remembered in
`uv:selection`), then Create shows the uniform. Rank and branch items are worn from the selection and are locked
(cannot be removed on the uniform; Change uniform goes back). The library only lists categories with
`selectable: true`. Selection logic is `src/lib/selection.ts`, art lookup with service/uniform fallback is
`src/lib/art.ts`, options are `src/data/options.json`. Details: `docs/ADDING_BADGES.md`.

## Layout

- `src/data/` all content: `categories.json`, `badges.json`, `options.json`, `uniforms/<id>.json` (13: number-1 for every service and gender, number-2/number-5 per service and gender), `schema.ts` (zod)
- `src/lib/placement.ts` pure rules and layout. Add rules here, with tests in `placement.test.ts`
- `src/components/` UI only. No rules or content in components
- `public/uniforms/` uniform art, `public/badges/<category>/<slug>.png` redrawn badge art
- `reference/samples/` the user's own Nano Banana uniform samples (Number 1, 2, 5) and screenshots of the
  Uniformity app that inspired the library and placement-guide screens
- `scripts/` `validate-data.ts` (data and art checks) and `import-art.ts` (bundle importer)
- Accessories are ordinary library items: `public/badges/shoulder-boards|rank-insignia|gorgets/<slug>.png`
  (slug = rank, e.g. `2lt`, `3sg`, `plain`). They are imported, not hand-edited: change the art in
  `badge-art-pipeline` and re-import
- `src/data/mounted/<uniform>.json` + `public/mounted/` imported perspective sprites for shoulders, sleeves
  and collar; `UniformStage` draws these instead of the flat badge

## Conventions

- A badge is identified by `category/slug`. Its art path is always `public/badges/<category>/<slug>.png`.
- Coordinates are in uniform image pixels (see `width`/`height` in the uniform JSON), never screen pixels.
- Only state a placement rule or limit that a source states. The sources for the current rules are
  https://www.army.gov.sg/our-forces/badges/ (which badges exist, where in words) and the SAF No.1 Dress
  guideline, March 2024 (`SAF+No.1+Dress.pdf`, kept outside this repo, Army No.1 section only: rank insignia
  p.8, medals and badges p.14-15) for the distances and limits. Where the two differ, the project owner decides.
  Anything guessed (anchor positions, `widthMm`) must keep `verified: false` / `sizeVerified: false` until
  checked against the dress regulations.
- A limit shared by several categories on one spot (3 SAF badges on the left chest) is `maxItems` on the anchor.
  `exclusiveGroup` on a badge means only one of that group is worn (marksmanship; IPPT gold or silver). `layoutOrder` puts a badge
  after the others on its spot (marksmanship below IPPT).
- Do not ship or commit the official reference photos. Redrawn art only.
- Art is stored flat and face-on. Never bake perspective into the flat PNG: the on-uniform view comes from
  sprites that the pipeline pre-renders and `npm run art:import` puts in `public/mounted/`.
- Medals are tall art in a square PNG: `heightMm` (88.4) and `widthMm` (32.3) on each badge set the box (the project owner
  asked for 85% of the earlier 104 x 38 mm), and the ribbon comes out 27 mm wide. SAF skill badges are a fixed 39 mm. `art:import` keeps `widthMm`/`heightMm` of entries that have a `heightMm`, because the
  pipeline does not send them. Check medals still look right after any import.
- An anchor can have `rotation` (degrees clockwise) and a `copy` spot: the arms badge is worn on both collars, tilted
  20 degrees either way to follow the slanted collar. This is flat art rotated in the app, not baked perspective.
- Categories worn one at a time (`maxWorn: 1`: shoulder boards, rank insignia, gorgets) swap the old
  item out when another is picked (`placeBadge` in `src/lib/placement.ts`).
- Keep the app working offline and from `file://` (Capacitor): use `assetUrl()` for files under `public/`,
  no absolute `/paths`, no network calls at runtime.
- Wrap `localStorage` access in try/catch. It can be unavailable.
- Mobile first: layouts must work at 390px wide, tap targets at least 40px.
- TypeScript strict. Run `npm run typecheck`, `npm test` and `npm run data:validate` before saying a task is done.

## Current state

Working slice: Number 1 uniform, click-to-place, placement rules (max 2 proficiency badges, no spot for
formation badges because the source does not say where they go), anchor overlay, size slider, saved state.
115 badges are catalogued: 75 from the Army page (the 3 proficiency ones have art, 72 show a placeholder
tile) plus the 40 No.1 accessories (28 shoulder boards incl. plain, 9 rank insignia, 3 gorgets), which are
placeable and drawn in perspective, as are the proficiency badges on the sleeve. No rank logic yet: any
board can be combined with any sleeve insignia. 8 SAF service medals (category `medals`) are placeable on the left chest: tall boxes (`heightMm`), top of the
row 6 cm above the left pocket flap, SAF badges stack 1 cm above them, foreign badges on the right chest
(category exists, no badges yet). `pxPerMm` 1.0 is still an assumption, so no anchor is `verified`. Art comes from the separate `badge-art-pipeline` project
(see `docs/ART.md`).
