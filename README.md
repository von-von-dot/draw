# Widmer Grid — Advanced v3

## Modes
- **Point** : cercles (sans fusion).
- **Fusion visuelle** : blur + compositing + seuil alpha (rendu raster).
- **Fusion vecteur** : marching squares → polygones → simplification + lissage → export `<path>`.
- **Pixel** : carrés de grille → export `<rect>`.

## Export (Option A)
- PNG/SVG : **forme seule** (pas de grille).
- Fusion visuelle : pour un rendu strictement identique, privilégier PNG.

## Plages étendues
- Colonnes/Lignes : jusqu’à 60
- Échantillonnage : jusqu’à 48
