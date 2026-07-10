# Kiosko Media Center v4 · versión estable

Aplicación web local para usar como kiosko multimedia en una pantalla pequeña, tablet, móvil Android o monitor táctil. La app funciona como un marco digital que muestra wallpapers, vídeos y elementos de colecciones, y reacciona a eventos de Plex/Tautulli, Playnite, Sonarr/Radarr y notificaciones REST externas.

## Concepto actual

La aplicación se organiza alrededor de tres vistas principales:

- **Dashboard**: vista principal tipo marco digital. Rota entre wallpapers, vídeos y colecciones seleccionadas.
- **Actual**: último contenido activo recibido desde Plex/Tautulli o Playnite.
- **Colecciones**: muro visual de items manuales con portada, backdrop, vídeo opcional y metadatos simples.

Además incluye:

- overlay global de notificaciones;
- dock flotante y reposicionable;
- panel externo `/admin.html` para configuración;
- assets persistentes en `data/assets/`;
- API REST genérica para notificaciones externas.

## Stack

- Node.js 22+
- Express
- WebSocket con `ws`
- Frontend HTML/CSS/JavaScript ES modules
- Persistencia JSON en filesystem
- Docker / Portainer

## Arranque local

```bash
npm install
npm start
```

Abrir:

```text
http://localhost:3000
```

Admin:

```text
http://localhost:3000/admin.html
```

## Despliegue Portainer

El proyecto está preparado para usar el volumen externo:

```text
kiosko_volume
```

Compose incluido:

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

Crear previamente el volumen en Portainer si no existe.

## Persistencia

```text
data/
├── settings.json
├── state.json
├── notifications.json
├── notification-idempotency.json
├── wallpapers.json
├── collections.json
├── custom-css/
└── assets/
    ├── wallpapers/
    ├── collections/
    ├── plex/
    ├── playnite/
    └── uploads/
```

## Webhooks

```text
Tautulli recomendado:        POST /webhook/tautulli
Tautulli legacy:             POST /webhook
Sonarr/Radarr unificado:     POST /webhook/arr
Sonarr/Radarr específico:    POST /webhook/arr/:source
Playnite:                    POST /webhook/playnite
```

## API principal

```text
GET    /api/health
GET    /api/settings
PUT    /api/settings
POST   /api/settings/reset
GET    /api/state
PUT    /api/state
GET    /api/notifications
POST   /api/notifications
POST   /api/notify
DELETE /api/notifications
GET    /api/wallpapers
POST   /api/wallpapers
PATCH  /api/wallpapers/:id
DELETE /api/wallpapers/:id
GET    /api/collections
POST   /api/collections
PATCH  /api/collections/:id
DELETE /api/collections/:id
POST   /api/collections/:id/items
PATCH  /api/collections/:id/items/:itemId
DELETE /api/collections/:id/items/:itemId
POST   /api/collections/:id/items/:itemId/move
GET    /api/custom-css/:name
PUT    /api/custom-css/:name
```

La API REST de notificaciones externas está documentada en `README-NOTIFICATIONS-API.md`.

## Dashboard

El Dashboard puede usar como fuentes:

- wallpapers de imagen/GIF;
- wallpapers de vídeo MP4/WebM;
- colecciones seleccionadas.

Los wallpapers normales se muestran sin blur. Los items de colección reciben tratamiento visual con backdrop atenuado/blur y portada grande. El movimiento de fondos se controla por JavaScript para evitar que CSS personalizado lo anule accidentalmente.

## Producción

El ZIP no debe incluir:

- `node_modules/`;
- `.env` con secretos;
- `data/` con contenido real;
- tokens de Plex.

El Dockerfile instala dependencias desde `https://registry.npmjs.org/` y evita depender de `package-lock.json` durante el build de Portainer.
