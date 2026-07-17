# 15 · Item Registry

## Qué es

Item Registry es la nueva base de datos permanente interna de Kiosko Media Center.

Archivo:

```text
data/items.json
```

Su objetivo es que un item no desaparezca del conocimiento de la app sólo porque salga de Backlog, On Deck o Colecciones.

## Por qué existe

Antes de v6.1, las vistas eran también los principales contenedores de datos:

```text
backlog.json
on-deck.json
completed-items.json
```

Con v6.1 se añade una capa común:

```text
items.json
```

Las vistas siguen existiendo y funcionando, pero el registro central permite escalar hacia:

- vista Base de datos;
- modo lista;
- export CSV;
- reglas futuras de Backlog;
- auditoría de items conocidos;
- relación episodio ↔ serie.

## Cómo se sincroniza

Cada vez que hay cambios relevantes en items, se programa una sincronización diferida:

```text
Backlog + On Deck + Colecciones
→ Item Registry
```

Variable:

```env
ITEM_REGISTRY_SYNC_DEBOUNCE_MS=250
```

También puede forzarse manualmente:

```text
POST /api/items/sync
```

## Qué guarda

Ejemplo simplificado:

```json
{
  "canonicalId": "plex:episode:17982",
  "entityId": "plex:series:1234",
  "parentEntityId": "plex:series:1234",
  "source": "plex",
  "type": "episode",
  "collectionType": "series",
  "title": "The X-Files",
  "subtitle": "Nuevo episodio · S01E24",
  "states": {
    "inBacklog": true,
    "inOnDeck": false,
    "completed": false
  },
  "status": "backlog",
  "firstSeenAt": "...",
  "lastSeenAt": "...",
  "updatedAt": "..."
}
```

## Estados

El registry no reemplaza todavía los stores existentes. Refleja su estado.

| Campo | Significado |
|---|---|
| `states.inBacklog` | El item está en Backlog. |
| `states.inOnDeck` | El item está en On Deck. |
| `states.completed` | El item está en Colecciones. |
| `status` | Resumen del estado principal. |

Prioridad de `status`:

```text
completed
on-deck
backlog
known
```

## Known

Un item con estado `known` es un item que la aplicación conoce, pero que actualmente no está en Backlog, On Deck ni Colecciones.

Esto será importante para la futura vista Base de datos.

## API

### `GET /api/items`

Consulta paginada.

Parámetros:

```text
page
limit
search
type
source
status
sort
direction
```

Ejemplo:

```text
/api/items?type=series&status=known&page=1&limit=60
```

### `GET /api/items/:canonicalId`

Devuelve un item concreto.

### `POST /api/items/sync`

Fuerza sincronización desde las vistas actuales.

## Rendimiento

El registry usa:

- JSON compacto;
- persistencia write-behind;
- sincronización diferida;
- metadatos saneados sin `raw`.

No se envía completo en `/api/snapshot`.

## Futuro

v6.2 construirá la vista Base de datos encima de este store.
