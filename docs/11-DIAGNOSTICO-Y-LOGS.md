# 11 · Diagnóstico y logs

## Filosofía

La app debe ser silenciosa en producción normal, pero capaz de explicar qué está ocurriendo cuando algo se ralentiza.

Por defecto:

```env
DEBUG_HTTP=0
TRACE_ITEMS=0
TRACE_WS=0
```

## Endpoint principal

```text
GET /api/diagnostics
```

Incluye:

- estado del proceso;
- memoria;
- uptime;
- configuración de logs;
- WebSockets activos;
- conteos de datos;
- tamaños de ficheros;
- snapshot estimado;
- últimas requests API;
- últimos payloads;
- últimos broadcasts;
- últimas acciones;
- últimos snapshots.

## Logs de arranque

Ejemplo:

```text
Kiosko Media Center v6.0 escuchando en puerto 3000
Plex configurado: sí (URL: sí, token: sí)
Datos persistentes: /app/data
Kiosko Media Center v6.0 escuchando en 0.0.0.0:3000
Acceso local sugerido: http://172.20.0.5:3000
Diagnóstico: /api/health · /api/diagnostics
```

## Logs WebSocket

```text
[ws] conectado activos=1
[ws] cerrado activos=0
```

Indican clientes vivos.

## Logs de API lenta

Si una API supera `SLOW_API_LOG_MS`:

```text
[slow-api] GET /api/snapshot -> 200 1435ms
```

Variable:

```env
SLOW_API_LOG_MS=750
```

## Logs de payload

Si `TRACE_ITEMS=1` o el payload supera `TRACE_PAYLOAD_BYTES`:

```text
[payload] snapshot bytes=6144710
```

Variable:

```env
TRACE_PAYLOAD_BYTES=250000
```

## Logs de acciones

Para acciones de item:

```text
[action:start] backlog.to-deck POST /api/backlog/plex/123/deck ws=1
[action:end] backlog.to-deck 45ms bytes=12000
[action:error] backlog.to-deck Error...
```

Se registran también en memoria para `/api/diagnostics`.

## Logs delta

Cuando se emite un evento delta:

```text
[delta] item:moved-to-deck clients=1 bytes=12000 ms=3
[ws:broadcast] type=item:moved-to-deck clients=1/1 bytes=12000 ms=3
```

## Logs Tautulli

Para eventos Tautulli:

```text
Webhook Tautulli recibido { path: '/webhook', event: 'created', ratingKey: '17982' }
[tautulli] backlog candidate { ... }
[tautulli] backlog upserted { ... }
[tautulli] backlog skipped { ... }
```

### Interpretación

`backlog candidate` significa que el evento puede entrar en Backlog.

`backlog upserted` significa que se ha creado o actualizado.

`backlog skipped` indica motivo de descarte:

- watched;
- fuente desactivada;
- no library added;
- playback desactivado;
- etc.

## Logs de persistencia

Si una escritura tarda demasiado:

```text
[persist] backlog.json 430ms
```

Esto puede indicar:

- volumen Docker lento;
- NAS;
- disco saturado;
- JSON muy grande.

## Diagnóstico recomendado para lentitud

Activar temporalmente:

```env
TRACE_ITEMS=1
TRACE_WS=1
SLOW_API_LOG_MS=500
```

Probar:

- Backlog → On Deck;
- Backlog → Completar;
- On Deck → Backlog;
- On Deck → Completar;
- borrar item;
- evento Tautulli `created`.

Luego consultar:

```text
/api/diagnostics
```

Revisar:

- `recent.actions`;
- `recent.broadcasts`;
- `recent.payloads`;
- `recent.snapshots`;
- `recent.requests`;
- `files`;
- `counts`.

## Qué mirar si snapshot pesa mucho

En `/api/diagnostics`:

```json
{
  "payloads": {
    "snapshotBytes": 6144710,
    "snapshotBuildMs": 200
  }
}
```

Si `snapshotBytes` es alto:

1. revisar número de items;
2. revisar metadata pesada;
3. revisar `completed-items.json`;
4. revisar `backlog.json`;
5. confirmar que `meta.raw` no llega al snapshot público.

## Qué mirar si hay muchos WebSockets

Logs:

```text
[ws] conectado activos=N
```

Si N crece mucho:

- comprobar pestañas abiertas;
- comprobar PWA móvil;
- revisar reconexiones;
- revisar túnel/proxy.

## Qué mirar si Tautulli no añade Backlog

Buscar:

```text
Webhook Tautulli recibido
[tautulli] backlog candidate
[tautulli] backlog upserted
[tautulli] backlog skipped
```

Si sólo aparece el webhook pero no candidate/upserted:

- evento no interpretado como library added;
- fuente Plex recently_added desactivada;
- error consultando Plex;
- Tautulli manda ratingKey no compatible.

## Desactivar diagnóstico

Volver a:

```env
TRACE_ITEMS=0
TRACE_WS=0
DEBUG_HTTP=0
```
