"""Download the official reference photos listed in reference/manifest.json.

Run on your own computer (uses only the Python standard library):

    python scripts/fetch_references.py                 # everything
    python scripts/fetch_references.py proficiency     # one category
    python scripts/fetch_references.py proficiency/ippt-gold   # one badge

Files go to reference/images/<category>/<slug>.<ext>. That folder is git-ignored: the photos are
only inputs for redrawing (for example as the reference image for Nano Banana) and must not be
shipped in the app or committed.
"""
import json
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
manifest = json.loads((ROOT / "reference" / "manifest.json").read_text(encoding="utf-8"))
only = sys.argv[1] if len(sys.argv) > 1 else None

items = [
    i for i in manifest["items"]
    if only is None or i["key"] == only or i["category"] == only
]
if not items:
    sys.exit(f"Nothing matches '{only}'.")

ok = skipped = failed = 0
for item in items:
    dest = ROOT / "reference" / item["file"]
    if dest.exists():
        skipped += 1
        continue
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        req = urllib.request.Request(item["url"], headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            dest.write_bytes(resp.read())
        ok += 1
        print(f"downloaded {item['key']}")
        time.sleep(0.2)  # be polite to the server
    except Exception as exc:  # noqa: BLE001 - report and carry on
        failed += 1
        print(f"FAILED {item['key']}: {exc}")

print(f"done: {ok} downloaded, {skipped} already present, {failed} failed")
