#!/usr/bin/env python3
import json
import re
from pathlib import Path


def main():
    root = Path(__file__).resolve().parent.parent
    src = (root / "comics-data.js").read_text(encoding="utf-8")
    m = re.search(r"window\.TEGNESERIER\s*=\s*(\[.*\])\s*;?\s*$", src, re.S)
    if not m:
        raise SystemExit("Kunne ikke finde data i comics-data.js")
    data = json.loads(m.group(1))
    out = root / "data.json"
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Skrevet: {out} ({len(data)} rækker)")


if __name__ == "__main__":
    main()
