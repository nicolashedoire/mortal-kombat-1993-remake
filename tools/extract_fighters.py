#!/usr/bin/env python3
"""Export verified 1993 DOS fighter frames with character-specific palettes.

Reads the locally supplied MK1 files. This writes only assets/sprites/<fighter>;
it never overwrites assets.js. Regenerate the embedded data separately.
The frame choices were inspected against contact sheets; they are a compact
selection, not a full reproduction of the original animation tables.
"""
import os
from pathlib import Path
from ugra_extract import MkExec
from build_assets import decode_file, render

ROOT = Path(__file__).resolve().parent.parent
SOURCE = Path.home() / 'Desktop/Mortal_Kombat_1993/MK/MK1'

# Palette offsets refer to this particular supplied DOS executable. They are
# chosen by inspecting each character's appearance, including the ninja variants.
PALETTES = {'scorpion':0x9cb6a, 'subzero':0x9caaa, 'reptile':0x9cb3a,
            'liukang':0x9cd1a, 'kano':0x9cbfa, 'raiden':0x9ce9a}
# Frame numbers refer to filtered decoded frames, sorted by graphics data offset.
# Each move includes at least an anticipation and an action frame.
MOVES = {
 'NINJA': {'walk':[128,130,132,134], 'crouch':[40,41], 'jump':[50,51],
           'punch':[23,24], 'kick':[81,82], 'ko':[94], 'special':[23,24],
           'hit':[33], 'win':[190]},
 'KANG': {'walk':[2,4,6,8], 'crouch':[39,40], 'jump':[57,58],
          'punch':[12,13], 'kick':[77,78], 'ko':[52], 'special':[68,70],
          'hit':[33], 'win':[118]},
 'KANO': {'walk':[1,3,5,7], 'crouch':[117,118], 'jump':[51,52],
          'punch':[14,15], 'kick':[45,47], 'ko':[96], 'special':[14,15],
          'hit':[85], 'win':[114]},
 'RAIDEN': {'walk':[0,2,4,6], 'crouch':[26,27], 'jump':[60,61],
            'punch':[18,19], 'kick':[88,90], 'ko':[59], 'special':[74,77],
            'hit':[30], 'win':[126]},
}
CHARS = {'scorpion':'NINJA','subzero':'NINJA','reptile':'NINJA',
         'liukang':'KANG','kano':'KANO','raiden':'RAIDEN'}
# Offsets in STANCE.GRA rather than heuristic hue-based group detection.
STANCE = {'scorpion':[73268,77440,81596,85916],
          'subzero':[73268,77440,81596,85916],
          'reptile':[73268,77440,81596,85916],
          'liukang':[0,3348,6992,10496],
          'kano':[17340,21520,25536,29564],
          'raiden':[129204,134096,138948,143732]}

def main():
    mk = MkExec(str(SOURCE/'MK1.EXE'))
    stance = {off:(off,s,px) for off,s,px in decode_file(mk,'STANCE.GRA')}
    decoded = {}
    for kind in set(CHARS.values()):
        decoded[kind] = [f for f in decode_file(mk,kind+'.GRA')
                         if f[1][0] >= 15 and f[1][1] >= 15]
    for cid,kind in CHARS.items():
        if PALETTES[cid] not in mk.palettes:
            raise ValueError('Palette non trouvée : version de MK1.EXE différente')
        palette = mk.palettes[PALETTES[cid]][0]
        directory = ROOT/'assets'/'sprites'/cid
        directory.mkdir(parents=True, exist_ok=True)
        actions = {'idle':[stance[o] for o in STANCE[cid]]}
        actions.update({action:[decoded[kind][n] for n in indexes]
                        for action,indexes in MOVES[kind].items()})
        for action,frames in actions.items():
            # Remove obsolete frames of the same animation to avoid stale exports.
            for old in directory.glob(action+'_*.png'):
                old.unlink()
            for n,(_,descriptor,pixels) in enumerate(frames):
                img = render(pixels,descriptor[0],descriptor[1],palette)
                img.save(directory / f'{action}_{n}.png')
        print(cid, ', '.join(f'{k}:{len(v)}' for k,v in actions.items()))

if __name__ == '__main__':
    main()
