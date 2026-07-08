# Kiosko Media Center v4

Evolución del kiosko hacia un panel multimedia persistente con navegación por dock, Dashboard ambiental, Notifications, Plex, Game, Collections y Settings.

## Cambios principales

- Dashboard de wallpapers rotatorios como vista base ambiental.
- Dock inferior con seis vistas: Dashboard, Notifications, Plex, Game, Collections y Settings.
- Plex y Playnite son vistas persistentes, no popups temporales.
- Notificaciones nuevas muestran toast; al pulsarlo se abre Notifications.
- Atenuación configurable para Notifications, Plex y Game.
- Settings integrado dentro de la app.
- Wallapers, colecciones, settings, estado y notificaciones persistidos en `data/`.
- Assets guardados como archivos locales en `data/assets/`.
- CSS personalizado persistente por vista en `data/custom-css/`.

## Arranque local

```bash
npm install
npm start
```

Luego abre:

```text
http://localhost:3000
```

La configuración de Plex puede editarse desde la vista Settings. `.env` queda sólo como mecanismo inicial/compatibilidad.

## Webhooks

```text
Tautulli: POST /webhook/tautulli
Compatibilidad Tautulli antigua: POST /webhook
Sonarr/Radarr unificado: POST /webhook/arr
Playnite: POST /webhook/playnite
```

## Persistencia

```text
data/
├── settings.json
├── notifications.json
├── wallpapers.json
├── collections.json
├── state.json
├── custom-css/
└── assets/
    ├── wallpapers/
    ├── collections/
    ├── plex/
    ├── playnite/
    └── uploads/
```

## API básica

```text
GET /api/health
GET/PUT /api/settings
GET /api/notifications
GET/POST/PATCH/DELETE /api/wallpapers
GET/POST/PATCH/DELETE /api/collections
POST/DELETE /api/collections/:id/items
POST /api/collections/:id/items/:itemId/move
GET/PUT /api/custom-css/:name
```

## v4.4 · Modo ligero para Wallpaper Engine

Esta versión deja la interfaz en modo estable/liviano:

- Animaciones CSS desactivadas globalmente.
- Transiciones desactivadas.
- `filter`, `blur` y `backdrop-filter` desactivados.
- Transformaciones 3D eliminadas.
- Ken Burns del dashboard desactivado aunque la opción siga existiendo para futuras versiones.
- El dock sigue flotando y auto-ocultándose, pero sin animación.

La URL normal ya usa este modo ligero. No hace falta añadir `?compat=1`, aunque sigue siendo compatible.
