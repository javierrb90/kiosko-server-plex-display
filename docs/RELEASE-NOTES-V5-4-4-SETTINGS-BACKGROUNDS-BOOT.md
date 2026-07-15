# Kiosko Media Center v5.4.4

## Cambios

- Opciones reorganizadas en pestañas dentro del modal.
- Añadido panel de Fondos para Backlog y Colecciones:
  - tiempo de rotación;
  - opacidad;
  - blur;
  - color de capa;
  - duración del fade.
- Añadido fade entre cambios de fondo para evitar cortes bruscos.
- Añadido `GET /api/snapshot` para cargar el estado inicial por HTTP.
- La app muestra Backlog inmediatamente al arrancar y después hidrata datos por snapshot HTTP/WebSocket.
- Actualizado service worker a `kiosko-v5-4-4-shell` para evitar caché antigua.
