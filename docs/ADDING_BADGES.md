# Adding or updating badges

## A badge that already has an entry in `src/data/badges.json`

All 75 badges listed on https://www.army.gov.sg/our-forces/badges/ are already catalogued with
`status: "todo"`.

1. (Optional) `npm run refs:fetch` downloads the official photo for use as a reference.
2. Redraw it following `docs/STYLE.md` and save it as `public/badges/<category>/<slug>.png`.
3. `npm run data:sync` sets its status to `redrawn`.
4. `npm run dev` and check it on the uniform at the default size and at x1.

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

## A new category

Add it to `src/data/categories.json` (`wornOn`, `maxWorn` only if a source states a limit), then add it
to the `accepts` list of an anchor in each uniform file. Until a category has an anchor, placing it shows
"No placement spot".

## A new uniform

1. Put the front-view art (transparent PNG) in `public/uniforms/`.
2. Copy `src/data/uniforms/number-1.json`, change `id`, `name`, `image`, `width`, `height`, and move the anchors.
3. Import it in `src/data/index.ts` and add it to the `uniforms` list.
4. Keep `verified: false` on anchors until checked.

Different uniforms can wear different badges. The current page does not say which, so ask the user or
check the dress regulations before restricting any category per uniform.
