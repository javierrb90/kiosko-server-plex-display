# Variables recomendadas para producción

Archivo incluido: `.env.production.example`

Configuración recomendada:

```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
DATA_DIR=/app/data
MAX_PAYLOAD_MB=25
DEBUG_HTTP=0
SLOW_API_LOG_MS=750
PERSIST_DEBOUNCE_MS=350
TRACE_ITEMS=0
TRACE_WS=0
TRACE_PAYLOAD_BYTES=250000
```

Para diagnosticar lentitud puntual:

```env
TRACE_ITEMS=1
TRACE_WS=1
```

Después de capturar logs, volver a:

```env
TRACE_ITEMS=0
TRACE_WS=0
```

Endpoints útiles:

- `/api/health`
- `/api/diagnostics`

`/api/diagnostics` incluye:

- websockets activos;
- memoria;
- uptime;
- tamaños de ficheros JSON;
- conteo de items;
- últimos endpoints `/api`;
- últimos snapshots;
- últimos broadcasts;
- últimos payloads;
- últimas acciones de item.
