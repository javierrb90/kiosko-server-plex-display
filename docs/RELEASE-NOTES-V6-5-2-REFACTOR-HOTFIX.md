# v6.5.2 · Refactor hotfix

Esta versión corrige los problemas de integración de la Fase 2 y empieza a unificar el comportamiento de las vistas de items.

## Problema detectado

Aunque a nivel de producto las vistas son segmentaciones de una base común, técnicamente todavía había renderizados y controladores separados para:

- Backlog;
- On Deck;
- Colecciones;
- Base de datos.

Eso hizo que Grid/Lista, CSV y click de filas funcionaran en unas vistas y fallaran en otras.

## Corregido

- La vista Base de datos fuerza carga con `sync=1`.
- `/api/items` sincroniza desde Backlog, On Deck y Colecciones salvo que `ITEM_REGISTRY_SYNC_ON_QUERY=0`.
- Grid/Lista vuelve a funcionar correctamente en:
  - Base de datos;
  - Backlog;
  - On Deck;
  - Colecciones.
- Base de datos recupera botón rápido Grid/Lista en la barra.
- El modo Lista en On Deck y Colecciones renderiza filas reales, no un grid de una columna.
- Click en fila abre la ficha modal.
- CSV permanece dentro del modal de filtros.
- CSV de Colecciones queda conectado desde el modal.
- Añadido helper común:
  - `public/core/item-list-helpers.js`

## Reemplazo On Deck

Se corrige el bug crítico donde el item nuevo se eliminaba del Backlog antes de comprobar el límite.

Nuevo flujo:

```text
comprobar límite
si hay límite → responder 409 sin tocar Backlog
usuario elige reemplazo
quitar viejo de On Deck
devolver viejo a Backlog
quitar nuevo de Backlog
añadir nuevo a On Deck
emitir delta
```

## Service Worker

```text
kiosko-v6-5-2
```
