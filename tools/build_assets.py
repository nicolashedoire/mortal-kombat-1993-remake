#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pipeline d'assets du remake : sélection des frames par personnage,
application des bonnes palettes, export PNG + assets.js (base64).
Port du décodage LGPL de ReWolf (rewolf-mortal-kombat-viewer)."""
import os, sys, base64, json, colorsys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ugra_extract import MkExec, decode_pixels, c15_to_rgb

EXE = os.path.expanduser("~/Desktop/Mortal_Kombat_1993/MK/MK1/MK1.EXE")
GRA = os.path.expanduser("~/Desktop/Mortal_Kombat_1993/MK/MK1/GRAPHICS")
OUT = os.path.expanduser("~/Desktop/Mortal Kombat Remake/assets")

def decode_file(mk, name):
    data = open(os.path.join(GRA, name), "rb").read()
    ids = mk.find_file_ids(len(data))
    best = {}
    for fid in ids:
        tmp = {}
        for s in mk.sprites.get(fid, []):
            if s[5] >= len(data):
                continue
            w, h, x, y, f2, off = s
            px = decode_pixels(memoryview(data)[off:], w, h)
            if px:
                tmp[off] = (s, px)
        if len(tmp) > len(best):
            best = tmp
    return [(off, s, px) for off in sorted(best) for s, px in [(best[off][0], best[off][1])]]

def render(px, w, h, pal):
    img = Image.new("RGBA", (w, h))
    flat = []
    for idx in px:
        if idx == -1 or idx >= len(pal):
            flat += [0, 0, 0, 0]
        else:
            flat += list(c15_to_rgb(pal[idx])) + [255]
    img.putdata([tuple(flat[i:i+4]) for i in range(0, len(flat), 4)])
    return img

def avg_hue(px, w, h, pal):
    rs = gs = bs = n = 0
    for idx in px:
        if idx == -1 or idx >= len(pal):
            continue
        r, g, b = c15_to_rgb(pal[idx])
        rs += r; gs += g; bs += b; n += 1
    if n == 0:
        return None
    hh, ss, vv = colorsys.rgb_to_hsv(rs/n/255, gs/n/255, bs/n/255)
    return hh, ss, vv

def palettes_for(mk, px, max_idx):
    return [p for p in sorted(mk.palettes.values(), key=lambda p: len(p[0]))
            if len(p[0]) >= max_idx + 1 and len(p[0]) <= 256]

def pick_palette_by_hue(mk, frame_px, frame_w, lo, hi):
    """première palette dont la teinte moyenne du frame tombe dans [lo,hi] ET assez lumineuse."""
    max_idx = max(frame_px)
    best = None
    for pal in palettes_for(mk, frame_px, max_idx):
        hv = avg_hue(frame_px, frame_w, frame_px and 1, pal[0])
        if hv and lo <= hv[0] <= hi and hv[1] > 0.05 and hv[2] > 0.22:
            return pal[0]
        if hv and lo <= hv[0] <= hi and hv[1] > 0.05 and best is None:
            best = pal[0]
    return best

def hue_of(px, w, h, pal):
    hv = avg_hue(px, w, h, pal)
    return hv[0] if hv else 0

def main():
    mk = MkExec(EXE)
    os.makedirs(os.path.join(OUT, "sprites"), exist_ok=True)
    manifest = {}

    # ---- palettes ninja (choisies par teinte sur la frame 0 de NINJA) ----
    ninja = decode_file(mk, "NINJA.GRA")
    n0 = ninja[0][2]
    w0, h0 = ninja[0][1][0], ninja[0][1][1]
    pal_sc = pick_palette_by_hue(mk, n0, w0, 0.12, 0.18)   # jaune
    pal_sz = pick_palette_by_hue(mk, n0, w0, 0.54, 0.68)   # bleu
    pal_rep = pick_palette_by_hue(mk, n0, w0, 0.26, 0.38)  # vert
    print("palettes ninja:", "scorpion" if pal_sc else "MANQUE",
          "subzero" if pal_sz else "MANQUE", "reptile" if pal_rep else "MANQUE")

    def frames_of(name):
        return decode_file(mk, name)

    def pick_anim(frames, key):
        """heuristiques par silhouette : squat court, KO couché, saut étroit/haut."""
        items = []
        for off, s, px in frames:
            w, h = s[0], s[1]
            if w < 10 or h < 10:
                continue
            items.append((off, s, px, w, h))
        if not items:
            return []
        hs = sorted(h for _, _, _, _, h in items)
        ws = sorted(w for _, _, _, w, _ in items)
        hmax = hs[-1]
        wmax = ws[-1]
        res = []
        if key == "crouch":
            res = [it for it in items if it[4] <= hmax * 0.72 and it[3] >= it[4] * 0.8]
        elif key == "ko":
            res = [it for it in items if it[4] <= it[3] * 0.55]
        elif key == "jump":
            res = [it for it in items if it[4] >= hmax * 0.95 and it[3] <= wmax * 0.8]
        elif key == "wide":  # coups avec membres étendus
            res = [it for it in items if it[3] >= wmax * 0.88]
        elif key == "mid":
            res = [it for it in items if hmax * 0.75 <= it[4] <= hmax * 0.95 and it[3] <= wmax * 0.85]
        res.sort(key=lambda it: it[0])
        return res

    # ---- personnages : fichier + palette ----
    chars = {
        "scorpion": ("NINJA.GRA", pal_sc, None),
        "subzero": ("NINJA.GRA", pal_sz, None),
        "reptile": ("NINJA.GRA", pal_rep, "LIZ.GRA"),
        "liukang": ("KANG.GRA", None, None),
        "kano": ("KANO.GRA", None, None),
        "raiden": ("RAIDEN.GRA", None, None),
    }
    # ---- stances (segmentation par teinte + largeur entre frames consécutifs) ----
    stance = decode_file(mk, "STANCE.GRA")
    st_list = []
    for off, s, px in stance:
        w, h = s[0], s[1]
        if w < 10:
            continue
        max_idx = max(px)
        cands = palettes_for(mk, px, max_idx)
        if not cands:
            continue
        hv = avg_hue(px, w, h, cands[0][0])
        st_list.append((off, s, px, hv[0] if hv else 0, w))
    st_groups = []
    cur = []
    prev = None
    for it in st_list:
        hh, w = it[3], it[4]
        if prev is not None and (abs(hh - prev[0]) > 0.05 or abs(w - prev[1]) > 6):
            st_groups.append(cur)
            cur = []
        cur.append((it[0], it[1], it[2]))
        prev = (hh, w)
    if cur:
        st_groups.append(cur)
    print("groupes de stance:", [len(g) for g in st_groups])
    # attribution par teinte/largeur : ninja=flesh x23, kano=orange, sonya=rose,
    # liukang=flesh x30 58-60, raiden=brun x22, cage=flesh large x29
    def grp_hue_w(g):
        if not g:
            return 0, 0, 0
        off, s, px = g[0]
        max_idx = max(px)
        cands = palettes_for(mk, px, max_idx)
        hv = avg_hue(px, s[0], s[1], cands[0][0]) if cands else None
        return (hv[0] if hv else 0), s[0], s[2]  # hue, largeur, x
    def find_grp(hue_lo, hue_hi, w_lo, w_hi, x_lo=-999, x_hi=999):
        for g in st_groups:
            hh, w, x = grp_hue_w(g)
            if hue_lo <= hh <= hue_hi and w_lo <= w <= w_hi and x_lo <= x <= x_hi:
                return g
        return None
    g_ninja = find_grp(0.0, 0.10, 50, 60, 20, 26)
    g_kano = find_grp(0.07, 0.14, 48, 58, 18, 24)
    g_sonya = find_grp(0.88, 1.0, 40, 50) or find_grp(0.0, 0.02, 40, 50)
    g_liukang = find_grp(0.0, 0.10, 55, 64, 27, 33)
    g_raiden = find_grp(0.05, 0.12, 54, 66, 20, 26)
    g_cage = find_grp(0.0, 0.10, 64, 72, 26, 33)
    stance_map = {
        "scorpion": g_ninja or [],
        "subzero": g_ninja or [],
        "reptile": g_ninja or [],
        "kano": g_kano or [],
        "liukang": g_liukang or [],
        "raiden": g_raiden or [],
    }

    for cid, (fname, pal, extra) in chars.items():
        frames = frames_of(fname)
        use_pal = pal
        if use_pal is None:
            # palette par défaut (la plus petite couvrant les indices)
            m0 = max(frames[0][2]) if frames else 0
            cands = palettes_for(mk, frames[0][2], m0) if frames else []
            use_pal = cands[0][0] if cands else None
        if use_pal is None:
            print(cid, ": PAS DE PALETTE"); continue
        st = stance_map.get(cid, [])
        anims = {}
        def add(anim, items, maxn=3):
            imgs = []
            for it in items[:maxn]:
                off, s, px = it[:3] if len(it) >= 3 else (None, None, None)
                if px is None: continue
                w, h = s[0], s[1]
                imgs.append(render(px, w, h, use_pal))
            anims[anim] = imgs
        # idle : stance (palette du perso appliquée — ninjas utilisent leur palette)
        st_items = [(off, s, px) for off, s, px in st]
        add("idle", st_items, 4)
        # walk : frames "mid" espacées
        mids = pick_anim(frames, "mid")
        add("walk", mids, 4)
        crouch = pick_anim(frames, "crouch")
        add("crouch", crouch, 2)
        jumps = pick_anim(frames, "jump")
        add("jump", jumps, 2)
        wides = pick_anim(frames, "wide")
        half = len(wides) // 2
        add("punch", wides[:half], 2)
        add("kick", wides[half:], 2)
        kos = pick_anim(frames, "ko")
        add("ko", kos, 2)
        add("special", wides[:1], 2)
        add("hit", crouch[:1], 1)
        if not anims.get("idle"):
            add("idle", mids[:2], 2)
        # victoire : frame VICTORY dont la teinte se rapproche le plus du costume
        vict = decode_file(mk, "VICTORY.GRA")
        target_hue = {"scorpion": 0.15, "subzero": 0.60, "reptile": 0.32,
                      "kano": 0.10, "liukang": 0.05, "raiden": 0.08}[cid]
        best_v = None
        for off, s, px in vict:
            w, h = s[0], s[1]
            if w < 20 or h < 20:
                continue
            m0 = max(px)
            cands = palettes_for(mk, px, m0)
            if not cands:
                continue
            hv = avg_hue(px, w, h, cands[0][0])
            if not hv:
                continue
            if best_v is None or abs(hv[0] - target_hue) < abs(best_v[0] - target_hue):
                best_v = (hv[0], px, s)
        if best_v:
            add("win", [(0, best_v[2], best_v[1])], 1)
        # sauvegarde
        d = os.path.join(OUT, "sprites", cid)
        os.makedirs(d, exist_ok=True)
        manifest[cid] = {}
        for anim, imgs in anims.items():
            lst = []
            for i, img in enumerate(imgs):
                p = os.path.join(d, "%s_%d.png" % (anim, i))
                img.save(p)
                lst.append(p)
            manifest[cid][anim] = lst
        print(cid, {k: len(v) for k, v in anims.items()})

    # ---- FX : sang, glace, acide ----
    misc = frames_of("MISC.GRA")
    fx = {"blood": [], "ice": [], "acid": []}
    for off, s, px in misc:
        w, h = s[0], s[1]
        if w < 8 or h < 8:
            continue
        m0 = max(px)
        cands = palettes_for(mk, px, m0)
        if not cands:
            continue
        pal = cands[0][0]
        hv = avg_hue(px, w, h, pal)
        if not hv:
            continue
        hh, ss, vv = hv
        if vv < 0.25:
            continue
        if hh < 0.03 and ss > 0.55 and w <= 140:      # rouge = sang
            fx["blood"].append((off, w, h, px, pal))
        elif 0.55 <= hh <= 0.72 and ss > 0.4 and w <= 60:  # bleu = glace
            fx["ice"].append((off, w, h, px, pal))
        elif 0.22 <= hh <= 0.42 and ss > 0.35 and w <= 60:  # vert = acide
            fx["acid"].append((off, w, h, px, pal))
    print("FX:", {k: len(v) for k, v in fx.items()})
    manifest["fx"] = {}
    for kind, lst in fx.items():
        d = os.path.join(OUT, "sprites", "fx_" + kind)
        os.makedirs(d, exist_ok=True)
        paths = []
        for i, (off, w, h, px, pal) in enumerate(lst[:6]):
            p = os.path.join(d, "%s_%d.png" % (kind, i))
            render(px, w, h, pal).save(p)
            paths.append(p)
        manifest["fx"][kind] = paths

    # ---- assets.js (base64) ----
    js = ["window.GAME_ASSETS = { source: 'extracted', sprites: {} };"]
    sprites = {}
    def b64(p):
        return "data:image/png;base64," + base64.b64encode(open(p, "rb").read()).decode()
    for cid, anims in manifest.items():
        if cid == "fx":
            for kind, paths in anims.items():
                sprites["fx_" + kind] = [b64(p) for p in paths]
            continue
        sprites[cid] = {}
        for anim, paths in anims.items():
            sprites[cid][anim] = [b64(p) for p in paths]
    js.append("window.GAME_ASSETS.sprites = " + json.dumps(sprites) + ";")
    with open(os.path.join(os.path.dirname(OUT), "assets.js"), "w") as f:
        f.write("/* Assets extraits des fichiers DOS originaux (Mortal Kombat 1993) */\n")
        f.write("\n".join(js))
        f.write("\n")
    print("assets.js écrit (%d octets)" % os.path.getsize(os.path.join(os.path.dirname(OUT), "assets.js")))

if __name__ == "__main__":
    main()
