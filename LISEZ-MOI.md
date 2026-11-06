# Mortal Kombat — remake amateur

Ouvrez **index.html** dans un navigateur récent. Choisissez « Jouer » : une fenêtre présente les commandes avant le lancement. Tous les fichiers nécessaires se trouvent dans ce dossier : aucune connexion Internet ni installation n'est nécessaire.

## Commandes

| Action | Joueur 1 | Joueur 2, pavé numérique |
|---|---|---|
| Se déplacer | ← / → | 4 / 6 |
| Sauter / s'accroupir | ↑ / ↓ | 8 / 2 |
| Poing haut / bas | A / Z | 7 / 1 |
| Pied haut / bas | E / C | 9 / 3 |
| Bloquer | S | 5 |

Les lettres correspondent à celles qui sont inscrites sur le clavier, en AZERTY comme en QWERTY. Pour le joueur 2, utilisez le pavé numérique et activez Verr. Num si nécessaire. Les touches ne sont pas encore personnalisables.

**Entrée** valide dans les menus. Pendant un combat, **Échap** met en pause ou reprend ; dans la pause, **Entrée** revient au menu. **H** ouvre ou ferme l'aide et suspend le combat ; **M** ou le bouton « Son » en bas de l’écran active ou coupe le son. Appuyez sur ↓ et poing haut pour un uppercut, et sur un poing ou un pied pendant un saut pour attaquer en l'air.

## Coups spéciaux

Les directions ci-dessous sont relatives au combattant : « avant » signifie vers l'adversaire et « arrière » signifie s'en éloigner. Saisissez les directions rapidement, puis le coup indiqué.

| Personnage | Coup | Commande |
|---|---|---|
| Scorpion | Harpon | arrière, arrière, poing bas |
| Sub-Zero | Boule de glace | bas, avant, poing bas |
| Reptile | Crachat acide | avant, avant, poing haut |
| Liu Kang | Boule de feu | avant, avant, poing haut |
| Liu Kang | Pied volant | avant, avant, pied haut |
| Kano | Couteau | arrière, avant, poing haut |
| Raiden | Éclair | bas, avant, poing bas |

Le mode solo propose trois adversaires et le mode versus permet de jouer à deux sur le même clavier. Chaque combat se joue en deux rounds gagnants. Le système de finition reste une adaptation simplifiée : pendant « FINISH HIM », saisissez le coup spécial du vainqueur.

## Son

La musique du menu et celle des combats utilisent deux pistes issues des fichiers d'origine. Les annonces « Fight », « Finish Him », « Fatality » et certains impacts proviennent aussi de ces fichiers ; les autres effets sont synthétisés. Le son est activé lors d'un clic ou d'une touche, selon les règles du navigateur. S'il est en attente, clique sur le bouton « Activer le son ».

## Graphismes et ressources

L'arène et les six combattants ont été recréés dans un style moderne inspiré de l'esthétique arcade. Les nouveaux sprites comportent plusieurs poses par personnage et des cycles courts : ils ne reproduisent pas toutes les images ni tous les mouvements du jeu original. Les sprites DOS restaurés restent intégrés en repli si un fichier moderne manque. Le jeu reste une adaptation, pas une reproduction intégrale de l'original.

Les outils d'extraction des fichiers uGRA/WrtNonZero s'appuient sur les travaux de ReWolf (LGPL v3) :
- http://blog.rewolf.pl/blog/?p=1837
- https://github.com/rwfpl/rewolf-mortal-kombat-viewer

`game.js` contient le moteur, `assets.js` les sprites arcade intégrés en repli, `assets/sprites-modern/` les nouveaux personnages et `tools/` les outils de préparation. Remake amateur non officiel ; utilisez les fichiers du jeu que vous possédez légalement.
