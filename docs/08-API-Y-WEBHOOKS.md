# 08 · API y webhooks

## Endpoints de estado

### GET `/api/health`

Devuelve estado básico:

```json
{
  "ok": true,
  "app": "Kiosko Media Center",
  "pid": 1,
  "uptimeSeconds": 123,
  "dataDir": "/app/data",
  "port": 3000,
  "time": "..."
}
```

### GET `/api/diagnostics`

Devuelve diagnóstico extendido.

Incluye:

- proceso;
- memoria;
- uptime;
- WebSockets activos;
- tamaños de ficheros;
- conteos de items;
- payload de snapshot;
- últimos endpoints;
- últimos broadcasts;
- últimos snapshots;
- últimas acciones.

### GET `/api/snapshot`

Carga inicial completa para el frontend.

Uso principal:

```text
arranque de la aplicación
```

No debe usarse como mecanismo para cada acción.

## Backlog

### GET `/api/backlog`

Devuelve Backlog, ratings y mapa On Deck.

### DELETE `/api/backlog/:source/:id`

Borra item de Backlog.

Emite delta:

```text
item:backlog-removed
```

### POST `/api/backlog/:source/:id/deck`

Mueve item de Backlog a On Deck.

Emite delta:

```text
item:moved-to-deck
```

### POST `/api/backlog/:source/:id/complete`

Marca item como completado/visto.

Emite delta:

```text
item:completed
```

## On Deck

### GET `/api/on-deck`

Devuelve On Deck.

### DELETE `/api/on-deck/:id`

Elimina item de On Deck.

Emite delta:

```text
item:deck-removed
```

### POST `/api/on-deck/:id/backlog`

Devuelve item a Backlog.

Emite delta:

```text
item:moved-to-backlog
```

### POST `/api/on-deck/:id/complete`

Marca item como completado.

Emite delta:

```text
item:completed
```

## Colecciones

### GET `/api/completions`

Devuelve items completados.

### PATCH `/api/completions/:id`

Actualiza item completado.

Emite delta:

```text
item:completion-updated
```

### DELETE `/api/completions/:id`

Elimina item de Colecciones.

Emite delta:

```text
item:completion-removed
```

## Grupos

### GET `/api/collection-groups`

Lista grupos.

### POST `/api/collection-groups`

Crea grupo.

### PATCH `/api/collection-groups/:id`

Actualiza grupo.

### DELETE `/api/collection-groups/:id`

Borra grupo.

### POST `/api/collection-groups/:id/items`

Añade item a grupo.

### DELETE `/api/collection-groups/:id/items/:itemId`

Quita item de grupo.

Los cambios de grupos emiten:

```text
collection-groups:update
```

## Notificaciones

### GET `/api/notifications`

Lista notificaciones.

### POST `/api/notifications`

Crea notificación externa.

### POST `/api/notify`

Alias para notificación externa.

### DELETE `/api/notifications`

Borra notificaciones.

## Webhooks

### POST `/webhook`

Webhook principal de Tautulli.

### POST `/webhook/tautulli`

Alias explícito para Tautulli.

### POST `/webhook/arr`

Webhook ARR.

### POST `/webhook/arr/:source`

Webhook ARR con fuente explícita.

## WebSocket

Kiosko usa WebSocket para actualizaciones en vivo.

Eventos importantes:

```text
socket:ready
settings:update
backlog:update
on-deck:update
completions:update
collection-groups:update
current:update
notification:new
notifications:cleared
item:backlog-upserted
item:backlog-removed
item:moved-to-deck
item:moved-to-backlog
item:completed
item:deck-removed
item:completion-updated
item:completion-removed
```

## Eventos delta

Los eventos delta evitan reenviar listas completas.

Ejemplo conceptual:

```json
{
  "type": "item:completed",
  "payload": {
    "from": "backlog",
    "removed": {},
    "completed": {},
    "completionRatings": {}
  }
}
```

El frontend actualiza estado local y renderiza vistas afectadas.
