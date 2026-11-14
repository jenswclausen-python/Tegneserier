#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path


def main():
    ap = argparse.ArgumentParser(description="Byg selvstændig index.html (enkeltfil) fra template.html + comics-data.js + app.js")
    ap.add_argument("--check", action="store_true", help="Tjek kun at index.html er i sync (exit 1 hvis ikke)")
    args = ap.parse_args()

    root = Path(__file__).resolve().parent.parent
    html = (root / "template.html").read_text(encoding="utf-8")
    data = (root / "comics-data.js").read_text(encoding="utf-8").replace("</script", "<\\/script")
    app = (root / "app.js").read_text(encoding="utf-8").replace("</script", "<\\/script")

    out = html.replace('<script src="comics-data.js"></script>', "<script>\n" + data + "\n</script>")
    out = out.replace('<script src="app.js"></script>', "<script>\n" + app + "\n</script>")
    if '<script src=' in out:
        sys.exit("Kunne ikke inline alle eksterne scripts i template.html")

    target = root / "index.html"
    if args.check:
        if not target.exists():
            sys.exit("index.html mangler — kør scripts/build_single.py")
        if target.read_text(encoding="utf-8") != out:
            sys.exit("index.html er ikke i sync — kør scripts/build_single.py")
        print("index.html er i sync")
        return
    target.write_text(out, encoding="utf-8")
    print(f"Skrevet: {target} ({len(out)} bytes)")


if __name__ == "__main__":
    main()
