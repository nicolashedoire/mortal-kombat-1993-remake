#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Composition des décors (sprites positionnés via x,y) + clustering des stances
+ recherche du décalage de palette des ninjas (Scorpion/Sub-Zero/Reptile)."""
import os, sys, struct, glob
from collections import Counter, defaultdict
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ugra_extract import MkExec, decode_pixels, c15_to_rgb

EXE = os.path.expanduser("~/Desktop/Mortal_Kombat_1993/MK/MK1/MK1.EXE")
GRA = os.path.expanduser("~/Desktop/Mortal_Kombat_1993/MK/MK1/GRAPHICS")
OUT = os.path.expanduser("~/Desktop/Mortal Kombat Remake/assets/extracted")

def decode_file(mk, name):
    """tous les sprites d'un fichier, triés par offset, avec x,y et palette."""
    p = os.path.join(GRA, name)
    data = open(p, "rb").read()
    ids = mk.find_file_ids(len(data))
    best = {}
    for fid in ids:
        sprites = [s for s in mk.sprites.get(fid, []) if s[5] < len(data)]
        tmp = {}
        for s in sprites:
            w, h, x, y, f2, off = s
            px = decode_pixels(memoryview(data)[off:], w, h)
            if px:
                tmp[off] = (s, px)
        if len(tmp) > len(best):
            best = tmp
    out = []
    for off in sorted(best):
        s, px = best[off]
        w, h, x, y, f2, off2 = s
        max_idx = max(px) if px else 0
        cands = sorted([p for p in mk.palettes.values() if len(p[0]) >= max_idx + 1],
                       key=lambda p: len(p[0]))
        pal = cands[0][0] if cands else None
        out.append((off, w, h, x, y, px, pal))
    return out

def render_rgba(px, w, h, pal, shift=0):
    img = Image.new("RGBA", (w, h))
    flat = []
    for idx in px:
        if idx == -1:
            flat += [0, 0, 0, 0]
        else:
            v = (idx + shift) & 0xFF
            if v >= len(pal):
                flat += [0, 0, 0, 0]
            else:
                flat += list(c15_to_rgb(pal[v])) + [255]
    img.putdata([tuple(flat[i:i+4]) for i in range(0, len(flat), 4)])
    return img

def dominant_rgb(img):
    cnt = Counter()
    for p in img.getdata():
        if p[3] > 0:
            cnt[(p[0] // 32 * 32, p[1] // 32 * 32, p[2] // 32 * 32)] += 1
    if not cnt:
        return (0, 0, 0)
    return cnt.most_common(1)[0][0]

def compose_stage(mk, name):
    sprites = decode_file(mk, name)
    W, H = 340, 210
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    big = []
    for off, w, h, x, y, px, pal in sprites:
        if pal is None or w < 3 or h < 3:
            continue
        img = render_rgba(px, w, h, pal)
        if x < -260 or x > W or y < -260 or y > H:
            continue
        canvas.alpha_composite(img, (x, y))
        big.append((w, h, x, y))
    return canvas, big

def main():
    mk = MkExec(EXE)
    os.makedirs(OUT, exist_ok=True)
    # --- décors ---
    for name in ["CHOP", "EMP", "GGORO"]:
        canvas, big = compose_stage(mk, name + ".GRA")
        p = os.path.join(OUT, "stage_%s.png" % name)
        canvas.save(p)
        # couverture
        alpha = canvas.getchannel("A")
        opaque = sum(1 for v in alpha.getdata() if v > 0) / (alpha.size[0] * alpha.size[1])
        print("stage %s: %d sprites composés, couverture opaque %.0f%%, sprites >= 60px: %d"
              % (name, len(big), opaque * 100, sum(1 for b in big if b[0] >= 60 or b[1] >= 60)))
    # --- stances : clustering par couleur ---
    sp = decode_file(mk, "STANCE.GRA")
    print("\nSTANCE (par offset):")
    for off, w, h, x, y, px, pal in sp:
        if w < 10:
            continue
        img = render_rgba(px, w, h, pal)
        print("  off=%d %dx%d xy=(%d,%d) dominante=%s" % (off, w, h, x, y, dominant_rgb(img)))
    # --- ninjas : recherche du shift de palette ---
    ninja = decode_file(mk, "NINJA.GRA")
    print("\nNINJA: shift -> dominante (frame 0) + validité")
    if ninja:
        off, w, h, x, y, px, pal = ninja[0]
        for shift in range(0, 24):
            img = render_rgba(px, w, h, pal, shift)
            print("  shift %2d: %s" % (shift, dominant_rgb(img)))

if __name__ == "__main__":
    main()
