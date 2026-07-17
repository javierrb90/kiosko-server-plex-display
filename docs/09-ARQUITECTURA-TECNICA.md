# 09 · Arquitectura técnica

## Stack

- Node.js.
- Express.
- WebSocket con `ws`.
- Frontend vanilla JavaScript modular.
- Persistencia JSON en disco.
- Docker/Portainer como entorno esperado.
- Sin base de datos externa.

## Estructura principal

```text
server.js
src/
  adapters/
  services/
  *-store.js
public/
  app.js
  style.css
  core/
  views/
docs/
data/  (en producción vía DATA_DIR)
```

## Backend

### `server.js`

Responsable de:

- crear servidor HTTP;
- montar API REST;
- montar webhooks;
- inicializar stores;
- inicializar servicios;
- crear WebSocket server;
- emitir eventos delta;
- construir snapshot;
- exponer health/diagnostics;
- normalizar flujos entre vistas.

### Stores

#### `src/backlog-store.js`

Contiene:

- `BacklogStore`;
- `CompletionStore`;
- helpers de canonicalización.

Responsable de:

- Backlog;
- Colecciones;
- ratings;
- deduplicación;
- persistencia JSON.

#### `src/on-deck-store.js`

Responsable de:

- On Deck;
- canonicalización de series Plex;
- actualización de actividad;
- persistencia JSON.

#### `src/collection-group-store.js`

Responsable de:

- grupos manuales;
- grupos dinámicos;
- grupos mixtos;
- pertenencia por IDs y claves estables.

#### `src/settings-store.js`

Responsable de configuración persistente.

#### `src/state-store.js`

Responsable de estado global persistente:

- vista activa histórica;
- lastPlex;
- lastGame;
- lastCurrent;
- privacidad;
- timestamps.

#### `src/event-store.js`

Responsable de:

- notificaciones;
- idempotencia;
- limpieza TTL.

## Servicios

### `src/services/plex-service.js`

Consulta Plex y normaliza metadata:

- movie;
- show;
- season;
- episode.

Construye:

- `canonicalId`;
- `canonicalRatingKey`;
- posters;
- backdrops;
- show metadata;
- raw metadata cuando es necesario.

### `src/asset-service.js`

Cachea assets remotos en disco.

## Adapters

### `src/adapters/tautulli.js`

Normaliza eventos Tautulli.

Convierte variantes como:

```text
created
recently_added
mediaadded
play
watched
```

a eventos internos.

### `src/adapters/playnite.js`

Normaliza eventos de Playnite.

### `src/adapters/arr.js`

Normaliza webhooks de Sonarr/Radarr.

## Frontend

### `public/app.js`

Responsable de:

- arranque;
- carga de snapshot;
- estado global de cliente;
- WebSocket;
- routing de vistas;
- actualización por eventos delta;
- notificaciones;
- opciones;
- diseño.

### `public/core/`

Componentes compartidos:

| Fichero | Propósito |
|---|---|
| `item-detail.js` | Modal de ficha y acciones contextuales. |
| `socket-client.js` | Cliente WebSocket. |
| `view-manager.js` | Registro y activación de vistas. |
| `ui.js` | Helpers UI/toast/modal. |

### `public/views/`

Vistas principales:

| Fichero | Vista |
|---|---|
| `backlog.js` | Backlog. |
| `on-deck.js` | On Deck. |
| `current-content.js` | Actual. |
| `collections.js` | Colecciones. |

## Estado de cliente

El frontend mantiene estado local para evitar recargar snapshot tras cada acción:

```js
state.backlog
state.onDeck
state.completions
state.collectionGroups
state.completionRatings
state.onDeckMap
```

Los eventos delta modifican esas estructuras y luego actualizan vistas.

## Snapshot

`GET /api/snapshot` devuelve estado inicial.

Payload principal:

```json
{
  "activeView": "...",
  "currentContent": {},
  "notifications": {},
  "settings": {},
  "backlog": {},
  "onDeck": [],
  "onDeckMap": {},
  "completions": [],
  "collectionGroups": [],
  "completionRatings": {},
  "state": {}
}
```

## Eventos delta

El backend emite eventos pequeños para acciones de item.

Ventajas:

- menor payload;
- menos coste de serialización;
- menos trabajo en frontend;
- UI más rápida;
- menos dependencia de snapshots.

## WebSocket

`RealtimeHub` encapsula:

- `send`;
- `broadcast`;
- conteo de clientes;
- trazas de tamaño/duración si se activan.

## Persistencia

La persistencia usa JSON en disco.

Varios stores usan escritura diferida:

```text
memoria actualizada
→ respuesta rápida
→ escritura agrupada tras PERSIST_DEBOUNCE_MS
```

## Canonicalización

La canonicalización evita duplicados.

### Plex

Ejemplos:

```text
plex:movies:<ratingKey>
plex:series:<showRatingKey>
plex:episode:<episodeRatingKey>
```

On Deck tiende a canonicalizar episodios/temporadas a serie.

Backlog puede conservar episodios como novedades concretas.

### Playnite

Ejemplo:

```text
playnite:<gameId o slug del título>
```

## Consideraciones técnicas

### No añadir dependencias innecesarias

La app es deliberadamente simple.

### No usar base de datos externa salvo decisión explícita

La persistencia JSON es suficiente para el tamaño actual, con diagnóstico de payloads y ficheros.

### No reintroducir broadcasts globales para acciones simples

Para acciones de item, preferir eventos delta.

### No sincronizar vista activa entre dispositivos

Cada navegador mantiene su vista local.

## Puntos delicados

- canonicalización Plex episode/show;
- relación Backlog episodio ↔ On Deck serie;
- tamaño de snapshot;
- metadata `raw`;
- persistencia en volúmenes lentos;
- Service Worker cache;
- cambios visuales responsive.
