# Art style

Match the Number 1 reference (`public/uniforms/number-1.png`, generated with Nano Banana). Every badge
must look like it belongs on that tunic.

## Rules

- Flat 2D vector look. Solid fills, no gradients, no gloss, no photographic texture, no drop shadow.
- One uniform thin dark outline around every shape. Reference outline colour is about `#3C3D3B`.
- Shading is limited to one highlight tone and one shade tone per colour.
- Front view, centred, on a transparent background, square canvas, generous margin.
- No text unless the real badge has lettering. Keep any lettering short and legible when small.
- Simplify. Badges are shown about 30-60 px wide on a phone, so drop fine detail (wreath leaves, tiny
  serrations) that would turn to noise. Keep the silhouette and the main symbol recognisable.

## Palette (sampled from the reference)

| Use | Colour |
| --- | --- |
| Outline | `#3C3D3B` |
| White cloth | `#FEFEFE` |
| Brass buttons / gold base | `#E5BD49` |
| Gold highlight | `#F1D77A` |
| Gold shade | `#A67C1F` |
| Silver base | `#8E99A6` |
| Silver highlight | `#C9D1D9` |
| Silver shade | `#4F5A66` |

Add colours here before using them in art, so every badge shares one palette.

## Export

- PNG, 512 x 512, transparent background, saved as `public/badges/<category>/<slug>.png`.
- Then run `npm run data:sync` to flip the badge from `todo` to `redrawn`.

## Prompt for image models (Nano Banana / Gemini image models)

Use the official photo from `reference/images/<category>/<slug>.<ext>` as the reference image, and add the
Number 1 uniform image as a style reference where the tool allows two images.

> Redraw the badge in the reference photo as a flat 2D vector-style game icon, front view, centred on a
> plain pure white background with generous margin. Keep the silhouette and main symbol of the real badge.
> Clean solid colour fills, one uniform thin dark charcoal outline (about 2px) around every shape, minimal
> shading limited to one lighter highlight tone and one darker shade tone per colour. No gradients, no gloss,
> no photographic texture, no drop shadow. No text unless the badge itself has lettering.
> Palette: gold base #E5BD49, highlight #F1D77A, shade #A67C1F; silver base #8E99A6, highlight #C9D1D9,
> shade #4F5A66; outline #3C3D3B.

Models give a white background, not transparency. `scripts/process_badge.py` handles the rest: it makes the
white (including white inside rings) transparent without a halo, crops, centres and resizes to 512 x 512.

    pip install pillow numpy
    python scripts/process_badge.py <generated.png> <category> <slug>
    python scripts/process_badge.py sheet.png proficiency marksmanship --box 1024,0,2048,1024   # one badge from a sheet

## Check each badge

Look at it at about 48 px wide next to the uniform. If you cannot tell which badge it is, simplify it.
