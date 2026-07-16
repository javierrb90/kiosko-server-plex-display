# v5.6.14 · WebSocket sólo para eventos

- WebSocket deja de ser dueño del estado global de interfaz.
- `state:snapshot` queda reservado para carga inicial por HTTP (`GET /api/snapshot`).
- Los snapshots recibidos por WebSocket se ignoran en frontend.
- Nuevas conexiones WebSocket reciben `socket:ready`, no un snapshot completo.
- Se elimina la sincronización remota de navegación (`view:show`) entre dispositivos.
- La vista activa sigue siendo local por navegador/dispositivo.
- WebSocket queda para eventos/updates concretos:
  - `notification:new`
  - `notifications:cleared`
  - `notifications:open`
  - `current:update`
  - `backlog:update`
  - `on-deck:update`
  - `completions:update`
  - `settings:update`
- Las notificaciones nuevas no renderizan el panel si está cerrado.
- Navegación entre vistas instantánea, sin transición perceptible.
- Fondos sin zoom/pan/movimiento; sólo crossfade por opacidad.
