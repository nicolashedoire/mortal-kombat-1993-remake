#!/usr/bin/env python3
"""Embed fighter PNGs into assets.js, retaining the existing effects sprites."""
import base64
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
assets_file = root / 'assets.js'
text = assets_file.read_text(encoding='utf-8')
marker = 'window.GAME_ASSETS.sprites = '
start = text.index(marker) + len(marker)
existing, _ = json.JSONDecoder().raw_decode(text[start:])
for name in ('scorpion', 'subzero', 'reptile', 'liukang', 'kano', 'raiden'):
    folder = root / 'assets' / 'sprites' / name
    actions = {}
    for path in sorted(folder.glob('*.png')):
        match = re.fullmatch(r'([a-z]+)_(\d+)', path.stem)
        if match:
            actions.setdefault(match.group(1), []).append((int(match.group(2)), path))
    if not actions.get('idle'):
        raise RuntimeError(f'No idle sprites for {name}')
    existing[name] = {action: ['data:image/png;base64,' + base64.b64encode(p.read_bytes()).decode('ascii')
                               for _, p in sorted(frames)]
                      for action, frames in actions.items()}
content = json.dumps(existing, ensure_ascii=True, separators=(',', ':'))
assets_file.write_text("/* Assets extraits des fichiers DOS originaux (Mortal Kombat 1993) */\n"
                       "window.GAME_ASSETS = { source: 'extracted', sprites: {} };\n"
                       + marker + content + ';\n', encoding='utf-8')
print('Embedded sprites for six fighters; existing effects retained.')
