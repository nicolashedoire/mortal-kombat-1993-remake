#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Extracteur Mortal Kombat 1 (DOS) — sprites uGRA
Port du code LGPL de ReWolf (rewolf-mortal-kombat-viewer) :
  Copyright (c) 2021 ReWolf — http://blog.rewolf.pl/
  License : GNU LGPL v3+ (code adapté, attribution conservée).
Usage : ugra_extract.py <MK1.EXE> <fichier.gra>...
"""
import os, sys, struct
from collections import defaultdict
from PIL import Image

STRUCT_USHORT_unpack = struct.Struct('<H').unpack
STRUCT_UINT_unpack = struct.Struct('<I').unpack

# ---------------- palette ----------------
def palette_from_bytes(data, pos):
    if pos + 2 > len(data):
        return None
    n = STRUCT_USHORT_unpack(data[pos:pos+2])[0]
    if n < 2 or n > 256:
        return None
    if pos + 2 + 2*n > len(data):
        return None
    colors = struct.unpack_from('<%dH' % n, data, pos + 2)
    if max(colors) >= 0x8000:
        return None
    if len(set(colors)) < 2 * len(colors) / 3:
        return None
    return ([0] + list(colors), pos, 2 + 2*n)

# ---------------- descripteurs de sprites ----------------
def sprite_from_bytes(buf):
    """buf = 12 octets. Renvoie [] ou liste de descripteurs (variante XY puis NoXY)."""
    if len(buf) < 8:
        return []
    w = STRUCT_USHORT_unpack(buf[:2])[0]
    if w >= 320 or w == 0:
        return []
    h = STRUCT_USHORT_unpack(buf[2:4])[0]
    if h >= 240 or h == 0:
        return []
    x, y = struct.unpack('<2h', buf[4:8])
    ret = []
    if -256 <= x <= 256 and -256 <= y <= 256 and len(buf) >= 12:
        idoff = STRUCT_UINT_unpack(buf[8:12])[0]
        ret.append((w, h, x, y, idoff >> 24, idoff & 0xFFFFFF))
    idoff = STRUCT_UINT_unpack(buf[4:8])[0]
    ret.append((w, h, 0, 0, idoff >> 24, idoff & 0xFFFFFF))
    return ret

# ---------------- décodage WrtNonZero ----------------
def decode_pixels(data, width, height, palette_shift=0):
    """data = memoryview du GRA (à partir de l'offset du sprite). Transparent = -1."""
    out = []
    wbak = width          # PAS de masque &0xFF : correct pour 320 px
    pos = 0
    while height != 0 and pos + 4 <= len(data):
        code = STRUCT_UINT_unpack(data[pos:pos+4])[0]
        pos += 4
        bit0 = code & 1
        code >>= 1
        bit1 = code & 1
        if bit0:
            if code > width * height:
                return []
            out.extend([-1] * code)
        elif bit1:
            code >>= 1
            pixel = code & 0xFF
            code >>= 8
            out.extend([(pixel + palette_shift) & 0xFF] * code)
        else:
            code >>= 1
            read_len = (code + 3) & 0xFFFFFFFC
            chunk = data[pos:pos+code]
            pos += read_len
            out.extend([(p + palette_shift) & 0xFF for p in chunk])
        width -= code
        if width != 0:
            continue
        width = wbak
        height -= 1
    return out if height == 0 else []

# ---------------- couleur 15 bits -> RGB ----------------
def c15_to_rgb(v):
    MULT = 255.0 / 63
    return (int(round((((v >> 9) & 0x3F) | 1) * MULT)),
            int(round((((v >> 4) & 0x3F) | 1) * MULT)),
            int(round((((v << 1) & 0x3F) | 1) * MULT)))

# ---------------- analyse de l'exécutable ----------------
class MkExec:
    def __init__(self, path):
        with open(path, 'rb') as f:
            self.data = memoryview(f.read())
        self.palettes = {}
        self.sprites = defaultdict(list)
        self.__palette_scan()
        self.__sprite_scan()
    def __palette_scan(self):
        pos = 0
        while pos < len(self.data):
            p = palette_from_bytes(self.data, pos)
            if not p:
                pos += 1
                continue
            self.palettes[pos] = p
            pos += p[2]
    def __sprite_scan(self):
        pos = 0
        while pos < len(self.data) - 8:
            for s in sprite_from_bytes(self.data[pos:pos+12]):
                self.sprites[s[4]].append(s)
            pos += 1
    def find_file_ids(self, file_size):
        ret = []
        pos = 0
        while pos < len(self.data) - 4:
            d0 = STRUCT_UINT_unpack(self.data[pos:pos+4])[0]
            if d0 != file_size:
                pos += 1
                continue
            # FileEntry partiel : flags=0x12, 3 zéros (offset+4 .. +20)
            part = struct.unpack_from('<4I', self.data, pos + 4) if pos + 20 <= len(self.data) else None
            if not part or part[0] != 0x12 or part[1] != 0 or part[2] != 0 or part[3] != 0:
                pos += 1
                continue
            file_id = 0
            table_pos = pos - 4 - 24
            while table_pos >= 0:
                fe = struct.unpack_from('<6I', self.data, table_pos) if table_pos + 24 <= len(self.data) else None
                if not fe:
                    break
                name_off, size, flags, unk0, buffer, unk1 = fe
                if name_off != 0 and size != 0 and flags == 0x12 and unk0 == 0 and buffer == 0 and unk1 == 0:
                    file_id += 1
                    table_pos -= 24
                else:
                    ret.append(file_id)
                    break
            pos += 1
        return ret

def best_sprites_for(mk, gra_data, file_ids, file_size):
    best = {}
    for fid in file_ids:
        sprites = [s for s in mk.sprites.get(fid, []) if s[5] < file_size]
        if not sprites:
            continue
        tmp = {}
        for s in sprites:
            w, h, x, y, _, off = s
            px = decode_pixels(gra_data[off:], w, h)
            if px:
                tmp[off] = (s, px)
        if len(tmp) > len(best):
            best = tmp
    return best

def pick_palette(mk, max_index):
    cands = sorted([p for p in mk.palettes.values() if len(p[0]) >= max_index + 1],
                   key=lambda p: len(p[0]))
    return cands[0][0] if cands else None

def sprite_to_png(px, w, h, pal):
    img = Image.new("RGBA", (w, h))
    flat = []
    for idx in px:
        if idx == -1 or idx >= len(pal):
            flat += [0, 0, 0, 0]
        else:
            flat += list(c15_to_rgb(pal[idx])) + [255]
    img.putdata([tuple(flat[i:i+4]) for i in range(0, len(flat), 4)])
    return img

if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit("usage: ugra_extract.py <MK1.EXE> <fichier.gra>...")
    exe_path = sys.argv[1]
    gra_paths = sys.argv[2:]
    mk = MkExec(exe_path)
    print("EXE analysé : %d palettes candidates, %d ids de fichiers avec sprites"
          % (len(mk.palettes), len(mk.sprites)))
    outdir = os.path.join(os.path.dirname(os.path.abspath(exe_path)), "extracted")
    for gp in gra_paths:
        with open(gp, 'rb') as f:
            data = memoryview(f.read())
        ids = mk.find_file_ids(len(data))
        if not ids:
            print("%s : aucun file_id trouvé" % gp)
            continue
        sprites = best_sprites_for(mk, data, ids, len(data))
        if not sprites:
            print("%s : aucun sprite décodé" % gp)
            continue
        base = os.path.splitext(os.path.basename(gp))[0]
        d = os.path.join(outdir, base)
        os.makedirs(d, exist_ok=True)
        sheet = None
        items = sorted(sprites.items(), key=lambda kv: kv[1][0][5])
        for i, (off, (s, px)) in enumerate(items):
            w, h, x, y, fid, off2 = s
            max_idx = max(px) if px else 0
            pal = pick_palette(mk, max_idx)
            if pal is None:
                continue
            img = sprite_to_png(px, w, h, pal)
            img.save(os.path.join(d, "%s_%03d.png" % (base, i)))
        print("%s : %d sprites exportés -> %s" % (gp, len(items), d))
