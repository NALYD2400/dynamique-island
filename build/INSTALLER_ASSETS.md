# Gabarits installateur Liquid Dynamic Island

## Fichiers utilisés par le build

- `build/installerSidebar.bmp` : image gauche de l'assistant.
- `build/installerHeader.bmp` : image en haut à droite des pages.
- `build/icon.ico` : icône de l'app, du setup, du désinstalleur et du tray.
- `build/installer.nsh` : textes et pages personnalisées du tunnel NSIS.
- `build/assistedMessages.yml` : textes français du choix d'installation.

## Exports Photoshop

### installerSidebar.bmp

- Taille : `164 x 314 px`
- Format : `BMP`
- Couleur : `RGB`, `24 bits`
- Transparence : non
- Zone utile conseillée : garder le logo et les textes importants à au moins `12 px` des bords.
- Rôle : visuel principal sur les pages bienvenue et fin.

### installerHeader.bmp

- Taille : `150 x 57 px`
- Format : `BMP`
- Couleur : `RGB`, `24 bits`
- Transparence : non
- Zone utile conseillée : logo compact, lisible même en petit.
- Rôle : bandeau des pages intermédiaires.

### icon.ico

- Format : `.ico` multi-résolution
- Tailles recommandées : `16`, `24`, `32`, `48`, `64`, `128`, `256 px`
- Couleur : `32 bits` avec alpha
- Rôle : setup, app Windows, raccourcis, désinstalleur, tray.

## Direction visuelle proposée

Style recommandé pour la `1.0.5` : fond sombre très propre, reflets type liquid glass, accent cyan/vert, logo lumineux centré, très peu de texte dans l'image. Les textes longs restent dans l'installateur pour éviter un rendu flou dans les BMP.
