# Where the badge art comes from

The art is **not made in this repo**. A separate program, `badge-art-pipeline` (sibling folder
`../badge-art-pipeline`), takes a library of raw photos of the real badges, converts them to the app's
drawing style, mounts shoulder boards, sleeve badges and gorgets on the uniform in perspective, and writes
a **bundle**. This app only imports bundles. The web app has no Python, no image models and no raw photos.

```
badge-art-pipeline:  python badgeart.py export   ->   export/number-1/   (bundle.json, badges/, mounted/)
uniform-visualiser:  npm run art:import -- ../badge-art-pipeline/export/number-1
                     npm run data:validate
```

## What an import changes

- `public/badges/<category>/<slug>.png`: flat art (library tile, close-up) for every category named in the bundle
- `src/data/badges.json`: the library entries of those categories (other categories are untouched)
- `public/mounted/<uniform>/` and `src/data/mounted/<uniform>.json`: the perspective sprites `UniformStage` draws

Categories in a bundle are replaced wholesale, so a rank removed from the pipeline disappears here too.
Today the bundle owns `shoulder-boards`, `rank-insignia`, `gorgets` and `medals`; the `proficiency` badges are
ordinary app art, and the pipeline only adds their sleeve sprites. Do not hand-edit the imported files:
change the art in the pipeline and re-import. `npm run art:import -- <folder> --dry` checks a bundle and
changes nothing.

## Adding or changing a badge's art

1. In `badge-art-pipeline`: add or change the item (see its README), `draw`, `compare`, `export`.
2. Here: `npm run art:import -- ../badge-art-pipeline/export/number-1`, `npm run data:validate`, `npm run dev`.

A single hand-drawn badge can still go straight into `public/badges/<category>/<slug>.png` followed by
`npm run data:sync`; use the pipeline's `process` command to make a generated image transparent and 512 px.
The drawing style (palette, outline, rules) is in the pipeline's `docs/STYLE.md`.

## Changing the uniform art

The pipeline keeps its own copy of `public/uniforms/<id>.png` (in `uniforms/`) to cut the sprites to the
sleeve outline. If you replace the uniform picture or move the shoulder/sleeve/collar geometry, update the
copy and `config/mounts.json` there, re-export and re-import.
