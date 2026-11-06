# Mortal Kombat — game guide

Open **index.html** in a recent browser. Choose **Jouer** (Play) to see the controls before starting. Keep all the files in the same folder: the game requires no installation or internet connection.

## Controls

| Action | Player 1 | Player 2, numeric keypad |
|---|---|---|
| Move | ← / → | 4 / 6 |
| Jump / crouch | ↑ / ↓ | 8 / 2 |
| High / low punch | A / Z | 7 / 1 |
| High / low kick | E / C | 9 / 3 |
| Block | S | 5 |

The letters correspond to the keys marked on your keyboard, whether it uses an AZERTY or QWERTY layout. Player 2 uses the numeric keypad; enable Num Lock if needed. Controls cannot currently be customized.

Press **Enter** to confirm a menu selection. During a fight, **Escape** pauses or resumes the game; while paused, **Enter** returns to the menu. **H** opens or closes the help screen and pauses the fight. **M** or the **Son** (Sound) button at the bottom of the screen turns sound on or off. Press ↓ and high punch for an uppercut, or press a punch or kick button while jumping for an aerial attack.

## Special moves

Directions are relative to your fighter: **forward** means toward the opponent, and **back** means away from them. Enter the directions quickly, followed by the indicated attack.

| Fighter | Move | Input |
|---|---|---|
| Scorpion | Harpoon | Back, back, low punch |
| Sub-Zero | Ice ball | Down, forward, low punch |
| Reptile | Acid spit | Forward, forward, high punch |
| Liu Kang | Fireball | Forward, forward, high punch |
| Liu Kang | Flying kick | Forward, forward, high kick |
| Kano | Knife throw | Back, forward, high punch |
| Raiden | Lightning bolt | Down, forward, low punch |

Solo mode features three opponents, and versus mode lets two players share one keyboard. Each match is won by the first fighter to win two rounds. The finishing system is simplified: during **FINISH HIM**, enter the winner's special move.

## Sound

The menu and fight music use two tracks from the original game files. The “Fight,” “Finish Him,” and “Fatality” announcements, as well as some impact sounds, also come from those files; the other effects are synthesized. Depending on browser settings, audio starts after a click or keypress. If it is waiting to start, click **Activer le son** (Enable sound).

## Graphics and resources

The arena and all six fighters have been recreated in a modern style inspired by the arcade aesthetic. The new sprites contain several poses per fighter and short animation cycles; they do not reproduce every frame or move from the original game. Restored DOS sprites remain available as a fallback if a modern file is missing. This is an adaptation, not a complete reproduction of the original.

The uGRA/WrtNonZero extraction tools draw on ReWolf's work (LGPL v3):

- http://blog.rewolf.pl/blog/?p=1837
- https://github.com/rwfpl/rewolf-mortal-kombat-viewer

`game.js` contains the engine, `assets.js` contains the embedded fallback arcade sprites, `assets/sprites-modern/` contains the new fighters, and `tools/` contains preparation utilities. This is an unofficial remake; use game files you legally possess.
