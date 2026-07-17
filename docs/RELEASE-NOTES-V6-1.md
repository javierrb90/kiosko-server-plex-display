# Release notes · Kiosko Media Center v6.1

## Objetivo

v6.1 introduce la base estructural para el nuevo enfoque de la aplicación:

```text
Base de datos permanente
→ Backlog / On Deck / Colecciones como vistas o estados
```

No añade todavía la vista visual de Base de datos. Esa queda preparada para v6.2.

## Cambios principales

- Nuevo store:
  - `src/item-registry-store.js`
- Nuevo fichero persistente:
  - `data/items.json`
- Nuevo concepto interno:
  - **Item Registry**
- Sincronización automática desde:
  - Backlog;
  - On Deck;
  - Colecciones.
- Nuevos endpoints:
  - `GET /api/items`
  - `GET /api/items/:canonicalId`
  - `POST /api/items/sync`
- `/api/diagnostics` incluye:
  - conteos del Item Registry;
  - estado de última sincronización;
  - tamaño de `items.json`.
- Export JSON incluye `itemRegistry`.
- Service worker actualizado a:
  - `kiosko-v6-1`
- `package.json` actualizado a:
  - `6.1.0`

## Qué NO cambia todavía

v6.1 no añade aún:

- vista Base de datos;
- límite de On Deck;
- modo lista;
- export CSV;
- redimensionado de assets;
- controles de fondo de ficha.

Es una versión de base para que esas mejoras se puedan construir encima sin romper el modelo actual.

## Modelo conceptual

Cada item conocido queda registrado con:

- `canonicalId`;
- `entityId`;
- `parentEntityId`;
- `source`;
- `type`;
- `collectionType`;
- `title`;
- `subtitle`;
- `poster`;
- `backdrop`;
- `rating`;
- `states`;
- `status`;
- `firstSeenAt`;
- `lastSeenAt`;
- `updatedAt`.

Estados:

```json
{
  "states": {
    "inBacklog": true,
    "inOnDeck": false,
    "completed": false
  },
  "status": "backlog"
}
```

## Estados posibles

| Estado | Significado |
|---|---|
| `backlog` | Está actualmente en Backlog. |
| `on-deck` | Está actualmente en On Deck. |
| `completed` | Está en Colecciones. |
| `known` | Conocido por la app, pero no visible en esas vistas. |

## Endpoint de consulta

Ejemplo:

```text
GET /api/items?page=1&limit=60&type=series&status=known
```

Parámetros:

- `page`;
- `limit`;
- `search`;
- `type`;
- `source`;
- `status`;
- `sort`;
- `direction`.

## Validación

Validado con:

- `node --check` en archivos críticos;
- import ESM de stores críticos.
