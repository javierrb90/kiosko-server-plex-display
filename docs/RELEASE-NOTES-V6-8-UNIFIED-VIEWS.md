# v6.8 · Unified Views

## Objetivo

Esta versión deja las vistas principales como segmentos de una misma base de datos JSON:

- Base de datos: todos los items.
- Backlog: items con seguimiento activo.
- On Deck: items destacados temporalmente.
- Colecciones: items con calificación/finalización.

## Cambios principales

- Nuevo renderer común para tarjetas, filas de lista, pills de estado, pills de grupos, filtros activos y paginación.
- Nuevas vistas unificadas basadas en `/api/items?view=...`.
- Backlog, On Deck, Colecciones y Base de datos ya no renderizan los items con plantillas distintas.
- Filtros de tipo/grupo/fuente/orden/paginación viven en el mismo modal de filtros para todas las vistas.
- Base de datos, Backlog, On Deck y Colecciones muestran grupos y estados con el mismo sistema visual.
- La URL hash tiene prioridad sobre la última vista local.
- Rutas soportadas:
  - `#/database`
  - `#/backlog`
  - `#/deck`
  - `#/collections`
  - `#/item/<canonicalId>?from=<view>`
- Abrir una URL de item carga el item desde `/api/items/:canonicalId` y abre la ficha.
- La paginación pasa a ser un footer común centrado en la parte inferior de la vista.
- El campo `subtitle`/detalle se conserva como estado orgánico de última actividad y puede editarse desde la ficha.
- Editar el detalle actualiza `lastActivityAt` y registra actividad manual.
- Las series siguen siendo entidad única, pero el detalle de episodio se conserva y ya no se degrada a “Serie” al mover entre vistas.

## Backend

- `ItemRegistryStore.query()` acepta `view=database|backlog|on-deck|collections`.
- El límite de consulta interna sube a 5000 para permitir filtrado local coherente por grupos.
- `GET /api/items/:canonicalId` sincroniza antes de devolver el item.
- `PATCH /api/items/:canonicalId/dates` acepta también `subtitle`.

## Service worker

```text
kiosko-v6-8
```
