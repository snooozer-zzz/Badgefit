# Adding or updating badges

## A badge that already has an entry in `src/data/badges.json`

All 75 badges listed on https://www.army.gov.sg/our-forces/badges/ are already catalogued with
`status: "todo"`.

1. Make the art in the `badge-art-pipeline` project (it holds the raw photos and the drawing style) and
   bring it in with `npm run art:import` (see `docs/ART.md`). A single hand-made badge can instead be saved as
   `public/badges/<category>/<slug>.png`, then `npm run data:sync` sets its status to `redrawn`.
2. `npm run dev` and check it on the uniform at the default size and at x1.

Statuses: `todo` (no art), `redrawn` (art in place), `verified` (art, size and placement checked against
the dress regulations). Only set `verified` when `sizeVerified` is true and the category's anchor is verified.

## A brand-new badge

Add an object to `src/data/badges.json`:

```json
{
  "slug": "ippt-gold",
  "name": "IPPT Gold",
  "category": "proficiency",
  "status": "todo",
  "widthMm": 30,
  "sizeVerified": false,
  "referenceUrl": "https://..."
}
```

`slug` is lowercase letters, digits and hyphens, unique within its category. Then follow the steps above.
`npm run data:validate` catches duplicates, unknown categories and missing art.

## Sources for placement rules

- https://www.army.gov.sg/our-forces/badges/: the badge list and where each kind is worn, in words.
- SAF No.1 Dress guideline, March 2024 (`SAF+No.1+Dress.pdf`, Army No.1 section only; the file is not in this
  repo): the distances and limits. Rank insignia p.8, medals / SAF badges / tabs / foreign badges p.14-15.
  Read the pictures as well as the text: the 6 cm, 1 cm and 15 cm are drawn there.
- Where the two differ, ask the project owner which wins. Write the source in the category's `source`.

Rules that need data on a badge: `exclusiveGroup` (only one of the group is worn, e.g. `"marksmanship"` or `"ippt"` for gold/silver) and
`layoutOrder` (higher number goes after, e.g. marksmanship is 1 so it sits below IPPT). A limit shared by
several categories on one spot is `maxItems` on the anchor.

## A new category

Add it to `src/data/categories.json` (`wornOn`, `maxWorn` only if a source states a limit), then add it
to the `accepts` list of an anchor in each uniform file. Until a category has an anchor, placing it shows
"No placement spot".

## A new uniform

1. Put the front-view art (transparent PNG) in `public/uniforms/`, named `<dress>-<service>-<gender>.png`
   (`number-2-rsaf-male.png`); the file `number-1.png` serves every service and gender.
2. Copy `src/data/uniforms/number-1.json` (same name as the uniform `id`) and change `id`, `name`, `image`,
   `width`, `height` and move the anchors. Three fields say who wears it: `dress` (an id in
   `src/data/options.json`), `services` and `genders` (ids in the same file). One drawing can serve several,
   as number-1 does. The selection screen offers a dress only when a drawing exists for the chosen service and
   gender; otherwise it shows it disabled as "Not drawn yet". `data:validate` rejects two drawings for the same
   dress, service and gender.
3. Nothing to register: every file in `src/data/uniforms/` is loaded (`src/data/index.ts`).
4. Keep `verified: false` on anchors until checked. An anchor that a drawing cannot have (a pocket flap on a
   mess dress) is left out, with the reason in the `note` of the anchors around it. A category with no anchor
   on a uniform shows "No placement spot" if placed.

Anchors can also have `rotation` (degrees clockwise), `copy` (a second spot, mirrored, e.g. both collars) and
`scale` (multiplies the badge size at that spot). `layout.pyramid: true` (with `align: "bottom"`) arranges 3 or
more badges with the first alone on top and the rest in a row below; the left-chest SAF badges use it.
`layout.rowGapPx` is the gap between the pyramid's rows (negative overlaps the boxes: the art has transparent padding). `minY`
is the highest y the badges at a spot may reach; it changes nothing on screen, a test checks it (3 SAF badges over medals
must stay below the shoulder board). Badge and medal sizes are fixed: they never change with the number worn.

Perspective sprites are looked up by uniform id. A uniform whose shoulders and sleeves are in the same place as
another's can set `mountedFrom` to that uniform's id and use its sprites: all 18 No. 2, No. 5 and No. 5J drawings use
number-1's (checked: the shoulder and sleeve outlines differ by a pixel or two). If a drawing's shoulders or
sleeves move, drop `mountedFrom` and re-export sprites for it from the pipeline.

Different uniforms can wear different badges. The current page does not say which, so ask the user or
check the dress regulations before restricting any category per uniform. The rules for No. 2 and No. 5 are the
Army No. 1 ones (project owner), except that they have no collar badge or gorget.

## The selection screen, ranks and branches

`src/data/options.json` lists the services, genders and dresses of the selection screen, which categories carry
a rank (`rank.categories`, in dropdown order) and which category is the branch (`branch.category`, arms).
A category with `selectable: false` in `categories.json` is not in the badge library (arms, shoulder boards,
rank insignia, gorgets and formation badges).

What a rank wears is read from `badges.json`, not written in code: the board whose `rank` matches, the rank
insignia and gorget with that `rank`, and the plain board when the rank is in its `usedBy`. A gorget replaces the
branch (arms) badge (`rank.replacesBranch`). To change which items a rank wears, change `rank` and `usedBy` there.

## Art for one service or one uniform (fallback)

Today every service wears the same art: `public/badges/<category>/<slug>.png` and the sprites in
`src/data/mounted/<uniform>.json`. To give RSAF or RSN its own board, add to that badge in `badges.json`:

```json
"artVariants": [{ "service": "rsaf", "path": "badges/shoulder-boards/rsaf/2lt.png" }]
```

`service` and/or `uniform` (a uniform id) can be set; the most specific match wins (uniform and service, then
uniform, then service) and anything unmatched falls back to the shared art. No UI change is needed.
Perspective sprites work the same way: a file in `src/data/mounted/` with a `"service"` field is used for that
service, otherwise the file of the uniform without one. This is `resolveBadgeArt` and `resolveMounted` in
`src/lib/art.ts`. Remember that `art:import` replaces the categories of a bundle, so `artVariants` on imported
categories (boards, insignia, gorgets, medals) would be lost: put such art in the pipeline's bundle first.
