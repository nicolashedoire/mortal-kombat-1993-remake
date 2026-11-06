#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Analyse des sprites extraits : dimensions, couleur dominante, planches-contact."""
import os, glob, sys
from collections import Counter, defaultdict
from PIL import Image

def dominant(png):
    im = Image.open(png).convert("RGBA")
    px = im.getdata()
    cnt = Counter()
    for p in px:
        if p[3] > 0:
            cnt[(p[0] // 32 * 32, p[1] // 32 * 32, p[2] // 32 * 32)] += 1
    if not cnt:
        return (0, 0, 0), 0
    c, n = cnt.most_common(1)[0]
    total = sum(cnt.values())
    return c, n / total

def main():
    base = os.path.expanduser("~/Desktop/Mortal_Kombat_1993/MK/MK1/extracted")
    for name in sorted(os.listdir(base)):
        d = os.path.join(base, name)
        if not os.path.isdir(d):
            continue
        pngs = sorted(glob.glob(os.path.join(d, "*.png")))
        if not pngs:
            continue
        sizes = Counter()
        doms = []
        for p in pngs:
            im = Image.open(p)
            sizes[im.size] += 1
            c, frac = dominant(p)
            doms.append((os.path.basename(p), im.size, c, round(frac, 2)))
        print(f"== {name}: {len(pngs)} sprites")
        print("   dims:", sizes.most_common(6))
        # premiers sprites
        for b, s, c, f in doms[:6]:
            print(f"    {b} {s} dominante{c} {f}")

if __name__ == "__main__":
    main()
