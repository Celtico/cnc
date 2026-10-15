#!/usr/bin/env python3
"""
Fons blanc fora de les fotos dels electrodomèstics (`public/appliances/*.webp`).

El mateix que fa l'app amb una foto pujada (`core/photo/whiteBackground.ts`): els píxels quasi blancs (els tres canals
≥ 252) **connectats amb la vora** de la foto passen a transparents i la foto es retalla al que queda. El blanc de dins
de l'aparell (la porta d'un rentaplats blanc) no toca la vora per un camí de blancs purs i es queda.

Ús: python3 scripts/appliance-photos.py public/appliances   (reescriu els .webp que tenen fons; idempotent: un
.webp que ja té transparència no es torna a tocar)
Cal Pillow.
"""
import sys
from collections import deque
from pathlib import Path

from PIL import Image

WHITE = 252


def trim(im: Image.Image) -> Image.Image | None:
    """La foto sense el fons, o `None` si no en té (cap píxel quasi blanc a la vora) o ja s'ha tret."""
    if im.mode == "RGBA" and im.getchannel("A").getextrema()[0] == 0:
        return None
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    bg = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        i = y * w + x
        if bg[i]:
            continue
        r, g, b, a = px[x, y]
        if a and (r < WHITE or g < WHITE or b < WHITE):
            continue
        bg[i] = 1
        px[x, y] = (255, 255, 255, 0)
        if x > 0:
            q.append((x - 1, y))
        if x < w - 1:
            q.append((x + 1, y))
        if y > 0:
            q.append((x, y - 1))
        if y < h - 1:
            q.append((x, y + 1))
    if not any(bg):
        return None
    box = im.getchannel("A").getbbox()
    return im.crop(box) if box else im


def main(folder: str) -> None:
    for f in sorted(Path(folder).glob("*.webp")):
        im = Image.open(f)
        out = trim(im)
        if out is None:
            print(f"{f.name}: sense fons blanc (o ja tret)")
            continue
        out.save(f, "WEBP", quality=85, method=6)
        print(f"{f.name}: {im.size} → {out.size}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "public/appliances")
