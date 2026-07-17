# v6.5.1 · Hotfix Phase 2

Corrige fallos detectados en v6.5 Phase 2.

## Corregido

- El modo Grid/Lista ahora cambia también en:
  - On Deck;
  - Colecciones.
- El click en filas de modo Lista abre la ficha modal.
- La vista Base de datos fuerza sincronización con Item Registry si está vacío.
- `GET /api/items` puede sincronizar con `sync=1`.
- `GET /api/items/export.csv` puede sincronizar con `sync=1`.
- El modal de reemplazo de On Deck aparece al superar el límite de 3 por categoría.
- El flujo de reemplazo reintenta la acción con `replaceId`.
- Export CSV se mueve al modal de filtros.
- Se eliminan los botones CSV sueltos de la barra superior.
- Export CSV queda funcional en:
  - Base de datos;
  - Backlog;
  - On Deck;
  - Colecciones.

## Service Worker

```text
kiosko-v6-5-1
```
