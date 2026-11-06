#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Extracteur Mortal Kombat 1 (DOS) — format cGRA
Spec : http://blog.rewolf.pl/blog/?p=1837 (ReWolf)
cGRA = palette 15 bits embarquée + frames compressées LZW (LSB-first, 9→12 bits).
uGRA (sprites) nécessite les métadonnées du .EXE : traité séparément.
"""
import struct, sys, os
from PIL import Image

# ---------------- BitReader (LSB-first) ----------------
class BitReader:
    def __init__(self, data):
        self.data = data
        self.data_pos = 0
        self.fillCache()
    def bitMask(self, n): return (1 << n) - 1
    def isEnd(self): return self.data_pos == len(self.data) and self.bits_len == 0
    def fillCache(self):
        self.bits = 0; self.bits_len = 0; cur = 0
        while cur < 8 and self.data_pos < len(self.data):
            self.bits |= (self.data[self.data_pos] << self.bits_len)
            self.bits_len += 8; self.data_pos += 1; cur += 1
        if self.isEnd(): return -1
        return self.bits_len
    def getBits(self, n):
        r = 0
        if n <= self.bits_len:
            self.bits_len -= n
            r = self.bits & self.bitMask(n)
            self.bits >>= n
        else:
            r = self.bits; blen = self.bits_len
            if self.fillCache() == -1: return -1
            r |= (self.getBits(n - blen) << blen)
        return r
    def getWord(self): return self.getBits(16)
    def getBytes(self, n): return bytes([self.getBits(8) for _ in range(0, n)])

# ---------------- LZW (variante MK) ----------------
def lzw_decompress(data, c=8):
    M_CLR, M_EOD, M_NEW = 1 << c, (1 << c) + 1, (1 << c) + 2
    br = BitReader(data)
    req_bits = c + 1
    next_shift = 1 << req_bits
    next_code = M_NEW
    finchar = -1
    oldcode = -1
    d = {}; htab = {}
    out = []
    while True:
        if br.isEnd():
            raise ValueError("LZW: fin de flux sans EOD")
        cur = br.getBits(req_bits)
        incode = cur
        if cur == M_EOD:
            break
        if cur == M_CLR:
            next_code = M_NEW
            req_bits = c + 1
            next_shift = 1 << req_bits
            finchar = -1
            oldcode = -1
            continue
        stack = []
        if cur == next_code:               # KwKwK
            cur = oldcode
            stack.append(finchar)
        while cur >= M_CLR:
            if cur not in htab:
                raise ValueError("LZW: code invalide %d" % cur)
            stack.append(htab[cur])
            cur = d[cur + 1]
        finchar = cur
        stack.append(cur)
        while stack:
            out.append(stack.pop())
        if next_code < 4096 and oldcode != -1:
            d[next_code + 1] = oldcode
            htab[next_code] = finchar
            next_code += 1
            if next_code >= next_shift and req_bits < 12:
                req_bits += 1
                next_shift = 1 << req_bits
        oldcode = incode
    return bytes(out)

# ---------------- conversion couleur 15 bits ----------------
def c15_to_rgb(v):
    # TRANSFER_PALETTES exact (part 2) : canaux VGA 6 bits, LSB forcé à 1, ×255/63
    return tuple(int(round((((v >> s) & 0x3F) | 1) * 255.0 / 63)) for s in (9, 4, -1))

# ---------------- parseur cGRA ----------------
def parse_cgra(data):
    br = BitReader(data)
    # palette
    n_rec = br.getWord()
    if not (1 <= n_rec <= 64):
        raise ValueError("nb enregistrements palette suspect : %d" % n_rec)
    pal = []
    for _ in range(n_rec):
        n = br.getWord()
        if n > 256:
            raise ValueError("enregistrement palette trop grand : %d" % n)
        for _ in range(n):
            pal.append(c15_to_rgb(br.getWord()))
    # frames
    frames = []
    while not br.isEnd():
        # alignement octet
        if br.bits_len % 8:
            br.getBits(br.bits_len % 8)
        # saut des octets de padding 0
        b = 0
        while b == 0 and not br.isEnd():
            b = br.getBits(8)
            if b == -1:
                b = 0
        if br.isEnd() and b == 0:
            break
        w = b | (br.getBits(8) << 8)
        h = br.getWord()
        c = br.getBits(8)
        if not (0 < w <= 1024 and 0 < h <= 1024 and c == 8):
            raise ValueError("en-tête frame invalide : %dx%d c=%d" % (w, h, c))
        chunks = []
        while not br.isEnd():
            n = br.getBits(8)
            if n == 0:
                break
            chunks.append(br.getBytes(n))
        pix = lzw_decompress(b"".join(chunks), c)
        if len(pix) != w * h:
            raise ValueError("frame %dx%d : %d px décodés" % (w, h, len(pix)))
        frames.append((w, h, pix))
    if not frames:
        raise ValueError("aucune frame")
    return pal, frames

def is_cgra(data):
    if len(data) < 8:
        return False
    n = struct.unpack_from("<H", data, 0)[0]
    if not (1 <= n <= 8):
        return False
    try:
        pal, frames = parse_cgra(data)
        return len(frames) > 0
    except Exception:
        return False

def save_png(path, pal, frames, outdir):
    base = os.path.splitext(os.path.basename(path))[0]
    os.makedirs(outdir, exist_ok=True)
    for i, (w, h, pix) in enumerate(frames):
        img = Image.new("P", (w, h))
        img.putdata(list(pix))
        flat = []
        for rgb in pal:
            flat += list(rgb)
        flat += [0] * (768 - len(pal) * 3)
        img.putpalette(flat)
        out = os.path.join(outdir, "%s_%02d.png" % (base, i))
        img.save(out)
        print("  -> %s (%dx%d, %d couleurs)" % (out, w, h, len(pal)))

if __name__ == "__main__":
    paths = sys.argv[1:]
    if not paths:
        sys.exit("usage: cgra_extract.py <fichier.gra>...")
    outdir = os.path.join(os.path.dirname(os.path.abspath(paths[0])), "extracted")
    for p in paths:
        data = open(p, "rb").read()
        try:
            if is_cgra(data):
                print("%s : cGRA OK" % p)
                pal, frames = parse_cgra(data)
                save_png(p, pal, frames, outdir)
            else:
                print("%s : PAS cGRA (uGRA probable)" % p)
        except Exception as e:
            print("%s : ERREUR %s" % (p, e))
