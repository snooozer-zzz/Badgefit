"""Turn a generated badge image (badge on a plain white background) into app-ready art.

    python scripts/process_badge.py <input.png> <category> <slug>
    python scripts/process_badge.py draft.png proficiency ippt-gold
    python scripts/process_badge.py sheet.png proficiency marksmanship --box 1024,0,2048,1024

What it does:
  1. makes the white background transparent (including white enclosed by the badge, e.g. inside a ring),
     and turns the soft edge between the dark outline and white into clean transparency (no white halo)
  2. crops to the badge, adds a small margin, centres it on a square canvas
  3. resizes to 512 x 512 and saves public/badges/<category>/<slug>.png

Afterwards run `npm run data:sync` to mark the badge as redrawn.

Needs: pip install pillow numpy
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUTLINE = np.array([60.0, 61.0, 59.0])  # docs/STYLE.md outline colour (#3C3D3B)
SIZE = 512
MARGIN = 0.06  # fraction of the canvas left empty around the badge


def remove_white(img: Image.Image) -> Image.Image:
    rgb = np.asarray(img.convert("RGB")).astype(np.float32)
    min_ch = rgb.min(axis=2)
    lum = rgb.mean(axis=2)

    white = min_ch >= 245
    # Band of pixels touching the white background: these are anti-aliased outline pixels.
    near_white = Image.fromarray((white * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))
    band = (np.asarray(near_white) > 0) & ~white

    alpha = np.ones(white.shape, dtype=np.float32)
    alpha[white] = 0.0
    # Outline blended with white: c = a*outline + (1-a)*white  ->  a = (255 - c) / (255 - outline)
    outline_lum = float(OUTLINE.mean())
    a_band = np.clip((255.0 - lum) / (255.0 - outline_lum), 0.0, 1.0)
    alpha[band] = a_band[band]

    out = rgb.copy()
    out[band] = OUTLINE  # un-mix: edge pixels become pure outline colour with partial alpha
    rgba = np.dstack([out, alpha * 255.0]).clip(0, 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def fit_square(img: Image.Image) -> Image.Image:
    bbox = img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if bbox is None:
        raise SystemExit("Nothing left after removing the background. Is the badge on a white background?")
    img = img.crop(bbox)
    side = max(img.size)
    inner = round(SIZE * (1 - 2 * MARGIN))
    scale = inner / side
    new = (max(1, round(img.width * scale)), max(1, round(img.height * scale)))
    # Resize in premultiplied alpha so transparent pixels do not bleed colour into the edges.
    resized = img.convert("RGBa").resize(new, Image.LANCZOS).convert("RGBA")
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(resized, ((SIZE - new[0]) // 2, (SIZE - new[1]) // 2), resized)
    return canvas


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("input")
    p.add_argument("category")
    p.add_argument("slug")
    p.add_argument("--box", help="crop box x0,y0,x1,y1 in pixels, for sheets with several badges")
    p.add_argument("--out", help="override output path")
    args = p.parse_args()

    img = Image.open(args.input)
    if args.box:
        x0, y0, x1, y1 = (int(v) for v in args.box.split(","))
        img = img.crop((x0, y0, x1, y1))
    result = fit_square(remove_white(img))

    dest = Path(args.out) if args.out else ROOT / "public" / "badges" / args.category / f"{args.slug}.png"
    dest.parent.mkdir(parents=True, exist_ok=True)
    result.save(dest, optimize=True)
    print(f"saved {dest} ({dest.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
