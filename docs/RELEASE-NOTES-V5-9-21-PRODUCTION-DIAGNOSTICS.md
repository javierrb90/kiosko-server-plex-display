# v5.9.21 · Production Diagnostics

No incluye backups automáticos ni manuales.

## Cambios

- `/api/diagnostics` ampliado:
  - websockets activos;
  - memoria de proceso;
  - uptime;
  - tamaños de ficheros JSON;
  - conteo de items por vista;
  - últimos endpoints `/api`;
  - últimos snapshots;
  - últimos broadcasts;
  - últimos payloads;
  - últimas acciones de item.
- Métricas recientes en memoria, sin escribir ficheros extra.
- Logs menos ruidosos por defecto:
  - `TRACE_ITEMS=0`;
  - `TRACE_WS=0`;
  - `DEBUG_HTTP=0`.
- `.env.production.example` listo para producción.
- Mantiene eventos delta, snapshot ligero y persistencia write-behind.
- Service worker actualizado a `v5.9.21`.

## Diagnóstico puntual

Activar temporalmente:

```env
TRACE_ITEMS=1
TRACE_WS=1
```

Después volver a:

```env
TRACE_ITEMS=0
TRACE_WS=0
```
