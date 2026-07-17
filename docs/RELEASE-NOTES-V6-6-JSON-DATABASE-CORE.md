# Release notes · Kiosko Media Center v6.6 · JSON Database Core

## Objetivo

v6.6 consolida la arquitectura para seguir usando JSON ahora y poder migrar a SQLite más adelante sin rediseñar la aplicación.

El centro de notificaciones se mantiene como JSON independiente porque es pequeño y acotado.

## Nuevo modelo

La base de datos interna queda dividida conceptualmente en:

```text
items.json
item-activity.json
backlog-entries.json
```

### `items.json`

Contiene entidades permanentes:

- juegos;
- películas;
- series.

Los episodios y temporadas no son items permanentes. Actualizan la entidad de la serie mediante actividad.

### `item-activity.json`

Registra eventos asociados a items:

- episodio añadido;
- reproducción;
- actividad reciente de Playnite;
- edición manual de fechas;
- futuras acciones relevantes.

### `backlog-entries.json`

Prepara Backlog como bandeja de actividad reciente, no como lista exclusiva de items no activos.

Esto permite que una serie esté en On Deck y aparezca también en Backlog cuando entra un episodio nuevo.

## Fechas consolidadas

Campos principales:

```text
firstSeenAt
lastActivityAt
completedAt
updatedAt
```

- `firstSeenAt`: entrada en base de datos.
- `lastActivityAt`: última actividad real del item.
- `completedAt`: fecha de finalización.
- `updatedAt`: actualización técnica interna.

## Eliminación definitiva

Desde la ficha de un item en Base de datos aparece la acción:

```text
Eliminar definitivamente
```

Elimina el item de:

- Item Database;
- Backlog;
- On Deck;
- Colecciones;
- grupos manuales;
- actividad asociada;
- assets locales propios enlazados desde poster/backdrop.

## Series y episodios

Un episodio o temporada de Plex se canonicaliza hacia la serie:

```text
plex:series:<grandparentRatingKey>
```

La información del episodio queda como actividad/detalle reciente, no como item permanente.

## UI

- La Base de datos usa el mismo color de borde por fuente que el resto de vistas.
- Los filtros de tipo en Base de datos aceptan cero, uno o varios tipos.
- Las tarjetas muestran fecha minimalista:
  - `✓` finalizado;
  - `↻` última actividad.
- La ficha permite editar fechas desde Base de datos.
- La ficha permite ajustar el diseño de fondo:
  - backdrop;
  - poster;
  - color sólido;
  - sin imagen;
  - oscurecimiento;
  - blur.

## Preparación para SQLite

Este modelo se puede migrar de forma directa:

```text
items.json           -> items
item-activity.json   -> item_activity
backlog-entries.json -> backlog_entries
collection-groups    -> groups / group_rules / group_items
```

## Service Worker

```text
kiosko-v6-6
```
