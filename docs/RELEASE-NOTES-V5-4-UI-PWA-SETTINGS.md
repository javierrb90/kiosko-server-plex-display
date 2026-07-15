# Kiosko Media Center v5.4

Iteración centrada en pulir la interfaz de la app de gestión multimedia.

## UI y grids

- El Backlog y Colecciones pasan a usar paginación por número fijo de items.
- El tamaño de carátula S/M/L ya no altera cuántos elementos hay por página.
- Los filtros pasan a ser conmutadores independientes:
  - Backlog: Películas, Juegos, Series.
  - Colecciones: Juegos, Películas, Series.
- Se elimina el botón Todo; por defecto todos los tipos están activos.
- El buscador conserva el foco mientras se escribe.
- Se guarda en `sessionStorage` el estado de filtros, búsqueda, página y tamaño por vista.

## PWA Android

- Añadido `manifest.webmanifest`.
- Añadidos iconos 192/512.
- Añadido service worker básico.
- Nota: Chrome/Android sólo ofrece instalación PWA completa en contexto seguro. En LAN por HTTP puede ser necesario usar HTTPS/reverse proxy o instalar desde `localhost`.

## Opciones

- Añadido bloque de Diseño:
  - color de acento;
  - tamaño de fuente;
  - densidad UI;
  - items por página de Backlog y Colecciones.
- Añadido bloque Debug:
  - notificación de prueba;
  - evento Plex simulado;
  - evento Playnite simulado.
- Añadido editor de CSS personalizado global dentro del modal de opciones.
