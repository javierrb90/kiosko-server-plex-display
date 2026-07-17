# 10 · Despliegue en producción

## Entorno esperado

La app está pensada para ejecutarse en Docker/Portainer.

Configuración habitual:

```text
container: kiosko
port: 3000
DATA_DIR: /app/data
network: arrnet
volume: kiosko_volume
```

Si se usa Cloudflare Tunnel, normalmente apunta a:

```text
http://kiosko:3000
```

## Variables recomendadas

Archivo incluido:

```text
.env.production.example
```

Contenido recomendado:

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

## Variables de diagnóstico

Para cazar problemas puntuales:

```env
TRACE_ITEMS=1
TRACE_WS=1
```

Después volver a:

```env
TRACE_ITEMS=0
TRACE_WS=0
```

## Docker Compose conceptual

Ejemplo orientativo:

```yaml
services:
  kiosko:
    build: .
    container_name: kiosko
    restart: unless-stopped
    init: true
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      DATA_DIR: /app/data
      DEBUG_HTTP: "0"
      TRACE_ITEMS: "0"
      TRACE_WS: "0"
      SLOW_API_LOG_MS: "750"
      PERSIST_DEBOUNCE_MS: "350"
    volumes:
      - kiosko_volume:/app/data
    networks:
      - arrnet

volumes:
  kiosko_volume:

networks:
  arrnet:
    external: true
```

## Arranque

Comando:

```bash
npm start
```

Internamente:

```bash
node --env-file-if-exists=.env server.js
```

Si `.env` no existe, Node continúa sin él.

## Logs esperados

Arranque correcto:

```text
Kiosko Media Center v6.0 escuchando en puerto 3000
Plex configurado: sí/no
Datos persistentes: /app/data
Kiosko Media Center v6.0 escuchando en 0.0.0.0:3000
Diagnóstico: /api/health · /api/diagnostics
```

## Endpoints de comprobación

```text
/api/health
/api/diagnostics
```

## Service Worker

La app usa Service Worker.

Tras actualizar versión:

- refrescar navegador;
- si la UI queda antigua, hacer hard refresh;
- en móvil/PWA, cerrar y abrir;
- si persiste, borrar cache del sitio.

v6.0 usa cache:

```text
kiosko-v6-0
```

## Recomendaciones de producción

### Mantener logs normales apagados

```env
DEBUG_HTTP=0
TRACE_ITEMS=0
TRACE_WS=0
```

### Usar trazas sólo temporalmente

Para depurar:

```env
TRACE_ITEMS=1
TRACE_WS=1
```

### Vigilar snapshot

Si `/api/snapshot` supera 1 MB, revisar:

```text
/api/diagnostics
```

Campos:

- `payloads.snapshotBytes`;
- `files`;
- `counts`;
- `recent.snapshots`.

### Vigilar WebSockets

`/api/diagnostics` indica clientes activos.

Logs:

```text
[ws] conectado activos=N
[ws] cerrado activos=N
```

Si N sube y no baja, investigar reconexiones o pestañas duplicadas.

## No incluido

v6.0 no incluye:

- backups automáticos;
- backups manuales;
- restauración de backups;
- vista Continuar;
- modo salón.
