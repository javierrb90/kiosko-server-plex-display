# Release notes · Kiosko Media Center v6.0

## Estado

v6.0 es la primera base estable del proyecto tras la serie v5.9.x.

Se toma como punto base para futuras mejoras.

## Hereda de v5.9.22

Incluye:

- Backlog;
- On Deck;
- Actual;
- Colecciones;
- Notificaciones;
- Opciones;
- grupos manuales/dinámicos/mixtos;
- filtros unificados;
- eventos delta;
- diagnóstico de producción;
- snapshot saneado;
- persistencia write-behind;
- integración Plex/Tautulli;
- integración Playnite;
- integración ARR;
- notificaciones externas;
- handling de Tautulli `created`.

## Cambio clave v6.0

Los eventos Tautulli `created` de episodios entran en Backlog como novedades aunque la serie ya esté en On Deck.

En ese caso se muestra:

```text
Serie en On Deck
```

## Producción

Se incluye:

```text
.env.production.example
```

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

## Diagnóstico

Endpoints:

```text
/api/health
/api/diagnostics
```

Logs opcionales:

```env
TRACE_ITEMS=1
TRACE_WS=1
```

## No incluido

No incluye:

- backups automáticos;
- backups manuales;
- restauración;
- vista Continuar;
- modo salón;
- sync de vista entre dispositivos.

## Validación

La release se valida con:

```bash
node --check
```

en archivos críticos y prueba de import ESM para módulos compartidos.
