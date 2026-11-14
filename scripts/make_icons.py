#!/usr/bin/env python3
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

BG = (37, 99, 235)
FG = (255, 255, 255)


def tegn_ikon(size, path):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = size // 5
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=BG + (255,))
    try:
        font = ImageFont.load_default(size=int(size * 0.62))
    except TypeError:
        font = ImageFont.load_default()
    bbox = d.textbbox((0, 0), "T", font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((size - w) / 2 - bbox[0], (size - h) / 2 - bbox[1] - size * 0.02), "T", font=font, fill=FG)
    img.save(path)
    print(f"Skrevet: {path} ({size}x{size})")


def main():
    root = Path(__file__).resolve().parent.parent
    tegn_ikon(192, root / "icon-192.png")
    tegn_ikon(512, root / "icon-512.png")


if __name__ == "__main__":
    main()
