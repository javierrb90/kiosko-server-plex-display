# Kiosko Media Center v5.4.3

## Cloudflare Tunnel / HTTPS / WSS

- Corregido el cliente WebSocket para usar protocolo dinámico:
  - `ws://` cuando la app carga por `http://`.
  - `wss://` cuando la app carga por `https://`.
- Esto evita el bloqueo de navegador por mixed content cuando se accede por dominio HTTPS detrás de Cloudflare Tunnel.
- Actualizado `service-worker.js` a cache `kiosko-v5-4-3-shell` para forzar renovación del cliente.
- `docker-compose.yml` actualizado para el despliegue previsto:
  - red externa `arrnet`;
  - hostname `kiosko`;
  - volumen externo `kiosko_volume`.

## Nota de despliegue

Si el navegador tenía instalada/cacheada una versión anterior como PWA, conviene cerrar la app, recargar una vez desde el navegador y, si hiciera falta, borrar los datos del sitio para renovar el service worker.
