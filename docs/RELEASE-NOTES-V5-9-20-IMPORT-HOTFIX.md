# v5.9.20 · Hotfix import y helpers Backlog

- Corrige el error de arranque:
  - `canonicalKeyForItem` ahora se exporta correctamente desde `src/backlog-store.js`.
- Restaura helpers que faltaban en `backlog-store.js`:
  - `normalizeSource`;
  - `normalizeRating`;
  - `canonicalKeyForItem`.
- Mantiene todos los cambios de v5.9.19:
  - eventos delta;
  - trazas detalladas;
  - snapshot ligero;
  - persistencia write-behind.
- Añadida prueba real de import ESM de `backlog-store.js` + `on-deck-store.js`, además de `node --check`.
