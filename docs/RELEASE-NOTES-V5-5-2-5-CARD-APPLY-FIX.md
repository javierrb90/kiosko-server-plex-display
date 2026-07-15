# v5.5.2.5 · Aplicación real del diseño de tarjetas

- Corregida la desconexión entre settings guardados y variables CSS aplicadas.
- `applyDesign()` usa ya el modelo definitivo:
  - `design.itemBackground.opacity`
  - `design.itemBackground.blur`
  - `design.itemBackground.overlayOpacity`
  - `design.cards.radius`
- Limpieza/migración de settings antiguos `design.cards.backdropOpacity/backdropBlur/overlayOpacity`.
- Añadida traza `applyDesign tarjetas` para verificar los valores CSS finales.
