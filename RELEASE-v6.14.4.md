# BBQueue v6.14.4

## Corrección del contenido actual tras recargar

Los eventos de actividad recibidos por `POST /api/v1/events` que representan una reproducción actual ahora actualizan de forma coherente:

- el estado en memoria del servidor;
- `lastCurrent` en el almacén persistente;
- `lastGame` para Playnite o `lastPlex` para Plex;
- el evento WebSocket `current:update`;
- el toast independiente `activity:received`.

Antes, el toast nuevo era correcto mientras la página permanecía abierta, pero al recargar se recuperaba el contenido actual anterior guardado por el webhook heredado.
