# Release notes · Kiosko Media Center v6.5 · Fase 2

## Incluye

Esta release agrupa la segunda fase del plan v6.x:

- v6.2 · Vista Base de datos
- v6.3 · Límite On Deck + reemplazo
- v6.4 · Modo Grid/Lista común
- v6.5 · Export CSV

## v6.2 · Vista Base de datos

Nueva vista principal:

```text
Base de datos
```

Características:

- se apoya en `Item Registry`;
- no se carga dentro del snapshot;
- usa `GET /api/items` con paginación;
- incluye búsqueda;
- filtros por tipo;
- filtro por estado;
- filtro por fuente;
- orden;
- grid/lista;
- paginación;
- ficha modal normal;
- acciones desde ficha:
  - añadir al Backlog;
  - añadir a On Deck.

## v6.3 · Límite de On Deck

On Deck queda limitado a:

```text
3 juegos
3 películas
3 series
```

Si se intenta añadir un cuarto item de una categoría:

1. el backend devuelve `deck_limit_reached`;
2. el frontend abre modal de reemplazo;
3. el usuario elige qué item sacar;
4. el nuevo item entra en On Deck;
5. el item reemplazado vuelve a Backlog.

La regla vive en backend, por lo que aplica desde:

- Backlog;
- Actual;
- Base de datos.

## v6.4 · Grid / Lista

Las vistas principales tienen modo visual:

```text
Grid
Lista
```

Aplicado a:

- Base de datos;
- Backlog;
- On Deck;
- Colecciones.

La lista usa filas compactas de texto y mantiene el click para abrir la ficha modal normal.

## v6.5 · Export CSV

Exportación CSV añadida a:

- Base de datos, desde backend con `/api/items/export.csv`;
- Backlog, desde cliente con filtros actuales;
- On Deck, desde cliente con filtros actuales;
- Colecciones, desde cliente con filtros actuales.

## Nuevos endpoints

```text
GET  /api/items/export.csv
POST /api/items/:canonicalId/backlog
POST /api/items/:canonicalId/deck
```

## Nuevos comportamientos WebSocket

Los eventos delta existentes se reutilizan:

```text
item:backlog-upserted
item:moved-to-deck
```

Cuando hay reemplazo de On Deck, el payload incluye:

```json
{
  "replaced": {}
}
```

El frontend devuelve ese item al Backlog localmente.

## Service Worker

```text
kiosko-v6-5
```

## Validación

- `node --check` en archivos críticos;
- import ESM de módulos críticos.
