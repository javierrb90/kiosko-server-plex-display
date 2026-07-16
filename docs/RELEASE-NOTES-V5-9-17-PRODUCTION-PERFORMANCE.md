# v5.9.17 · Rendimiento de persistencia en producción

- Reduce coste de escrituras JSON:
  - JSON compacto en stores persistentes;
  - no reescribe ficheros durante `init()` sólo por arrancar;
  - logs de persistencia lenta si una escritura tarda más de 250ms.
- Añade log de API lenta:
  - `[slow-api]` si una ruta `/api/` tarda más de 750ms;
  - configurable con `SLOW_API_LOG_MS`.
- El log HTTP completo queda opt-in con `DEBUG_HTTP=1`.
- Reduce broadcasts redundantes:
  - elimina llamadas a `broadcastState()` que ya eran no-op;
  - los updates de Backlog/On Deck incluyen `collectionGroups` para evitar refrescos extra.
- Mantiene `/api/health` y `/api/diagnostics`.
- Sin cambios visuales.
