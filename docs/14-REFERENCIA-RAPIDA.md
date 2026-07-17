# 14 · Referencia rápida

## Base

```text
Kiosko Media Center v6.0
```

## Vistas

| Vista | Archivo | Propósito |
|---|---|---|
| Backlog | `public/views/backlog.js` | Bandeja de novedades. |
| On Deck | `public/views/on-deck.js` | Seguimiento activo. |
| Actual | `public/views/current-content.js` | Contenido actual/reciente. |
| Colecciones | `public/views/collections.js` | Historial completado. |

## Backend principal

```text
server.js
```

## Stores

| Store | Archivo |
|---|---|
| Backlog | `src/backlog-store.js` |
| Colecciones | `src/backlog-store.js` / `CompletionStore` |
| On Deck | `src/on-deck-store.js` |
| Estado | `src/state-store.js` |
| Configuración | `src/settings-store.js` |
| Notificaciones | `src/event-store.js` |
| Grupos | `src/collection-group-store.js` |

## Integraciones

| Integración | Archivo |
|---|---|
| Plex | `src/services/plex-service.js` |
| Tautulli | `src/adapters/tautulli.js` |
| Playnite | `src/adapters/playnite.js` |
| Sonarr/Radarr | `src/adapters/arr.js` |

## Endpoints esenciales

```text
GET  /api/health
GET  /api/diagnostics
GET  /api/snapshot
POST /webhook
POST /webhook/tautulli
POST /api/notifications
POST /api/notify
```

## Eventos delta

```text
item:backlog-upserted
item:backlog-removed
item:moved-to-deck
item:moved-to-backlog
item:completed
item:deck-removed
item:completion-updated
item:completion-removed
```

## Producción

```env
NODE_ENV=production
PORT=3000
DATA_DIR=/app/data
DEBUG_HTTP=0
TRACE_ITEMS=0
TRACE_WS=0
```

## Diagnóstico puntual

```env
TRACE_ITEMS=1
TRACE_WS=1
```

## Validación mínima

```bash
node --check server.js
node --check public/app.js
node --check src/backlog-store.js
node --check src/on-deck-store.js
node --input-type=module -e "import { canonicalKeyForItem } from './src/backlog-store.js'; console.log('ok')"
```
