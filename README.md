# Kiosko Media Center v5.4

Aplicación web local para gestionar actividad multimedia de Plex/Tautulli y Playnite desde una interfaz visual, pensada primero para móvil/portrait y también usable en pantallas táctiles.

## Vistas principales

- **Backlog**: actividad reciente pendiente de clasificar. Agrupa Plex y Playnite en un grid único con filtros, búsqueda, tamaños de carátula y paginación por flechas.
- **Actual**: muestra lo que se está reproduciendo en Plex o el juego activo de Playnite. Ya no fuerza navegación automática.
- **Colecciones**: archivo de contenido visto/terminado con valoración, fecha y paginación.
- **Notificaciones**: centro auxiliar de actividad/log, mantenido como overlay.

## Cambios clave v5.4

- Dashboard eliminado como vista.
- Backlog como vista inicial por defecto.
- Configuración integrada en modal dentro de la app.
- Eliminada la página `/admin.html`.
- Eliminadas colecciones manuales antiguas y wallpapers del dashboard.
- Eliminado oscurecimiento automático de pantalla.
- Dock compacto fijo en la esquina superior izquierda, junto a notificaciones.
- Controles de cada vista en la esquina superior derecha.
- Grids reales alineados arriba/izquierda, sin centrar tarjetas sueltas.
- Paginación visible en Backlog y Colecciones.
- Fondos dinámicos por Backlog/Colecciones usando backdrops de los items filtrados.

## Fuentes de Backlog

Configurables desde Opciones:

- Plex · nuevo contenido añadido desde Tautulli.
- Plex · contenido reproducido.
- Playnite · juegos lanzados.

Los items que entran por reproducción de Plex se muestran igual que el contenido añadido; la diferencia queda sólo a nivel interno.

## Docker / Portainer

```yaml
services:
  kiosko-media-center:
    container_name: kiosko-media-center
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      PORT: 3000
      DATA_DIR: /app/data
    volumes:
      - kiosko_volume:/app/data

volumes:
  kiosko_volume:
    external: true
```

## Endpoints principales

```text
GET  /api/health
GET  /api/settings
PUT  /api/settings
POST /webhook/tautulli
POST /webhook/playnite
POST /webhook/arr/:source
GET  /api/notifications
DELETE /api/notifications
GET  /api/backlog
DELETE /api/backlog/:source/:id
POST /api/backlog/:source/:id/complete
GET  /api/completions
PATCH /api/completions/:id
DELETE /api/completions/:id
POST /api/current/clear
```

## Datos persistentes

```text
data/
├── settings.json
├── state.json
├── notifications.json
├── notification-idempotency.json
├── backlog.json
├── completed-items.json
└── assets/
    ├── plex/
    ├── playnite/
    └── uploads/
```


## Novedades v5.4

- Paginación estable por número de items, independiente del tamaño de carátula.
- Filtros multiselección por tipo: películas, juegos y series.
- Estado de vista guardado en sesión.
- PWA básica para instalación en Android cuando el navegador lo permita.
- Opciones ampliadas con Diseño, Debug y CSS personalizado.

## v5.4.1 · Caché local de assets Plex

Las imágenes de Plex se descargan al volumen persistente y se sirven desde `/assets/plex/...`, evitando cargar siempre desde `http://PLEX:32400/...X-Plex-Token=...` en el navegador.

## Despliegue con Cloudflare Tunnel

Desde la v5.4.3 el cliente WebSocket usa automáticamente `wss://` cuando la app se abre por HTTPS, así que funciona detrás de Cloudflare Tunnel sin bloqueo por mixed content.

El `docker-compose.yml` incluido usa la red externa `arrnet` y hostname `kiosko`, pensado para apuntar el túnel a `http://kiosko:3000` dentro de esa red.
