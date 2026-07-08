# Kiosko Media Center

Centro visual para eventos multimedia en red local. Recibe webhooks de Tautulli/Plex, Sonarr/Radarr y Playnite, los normaliza y los muestra en un dispositivo Android en modo kiosko.

## Endpoints principales

- `POST /webhook/tautulli` — eventos de Tautulli/Plex.
- `POST /webhook` — compatibilidad con la ruta antigua de Tautulli.
- `POST /webhook/arr` — ruta única para Sonarr y Radarr.
- `POST /webhook/playnite` — lanzamientos de juegos desde Playnite.
- `GET /settings.html` — panel local de configuración.
- `GET /api/health` — diagnóstico rápido.

## Configuración persistente

La configuración vive en `data/settings.json`. Si no existe, se crea automáticamente con valores por defecto.

Desde `/settings.html` se puede editar:

- URL y token de Plex.
- Activación del fundido AMOLED.
- Tiempo visible del dashboard antes de apagarse.
- Número de notificaciones por página.
- Duración de las vistas temporales de Plex y Playnite.
- Activación de integraciones.
- Eventos que disparan vistas o notificaciones.
- CSS personalizado por vista.

Los CSS personalizados se guardan en:

```text
data/custom-css/global.css
data/custom-css/notifications.css
data/custom-css/plex.css
data/custom-css/playnite.css
```

Estos archivos se cargan después del CSS base, por lo que sirven como overrides persistentes.

## Docker / Portainer

```bash
docker compose up -d --build
```

El volumen importante es:

```text
./data:/app/data
```

Ahí se conservan:

- `settings.json`
- `notifications.json`
- CSS personalizado
- futuros assets/cache

## Notas

- El proyecto está pensado para red local y HTTP.
- `.env` queda como compatibilidad inicial, pero Plex puede configurarse desde el panel.
- Si `settings.json` no tiene Plex configurado y `.env` contiene `PLEX_URL`/`PLEX_TOKEN`, se importarán en el primer arranque.
