# Kiosko Media Center · integración Playnite

Esta versión incorpora Playnite como fuente de eventos temporales, con la misma lógica visual que Plex: al iniciar un juego, el kiosko se despierta, muestra la ficha durante 5 segundos con barra de progreso, se funde a negro y vuelve internamente al Centro de notificaciones.

## Endpoint

Configura el script **Before Game Starts** de Playnite para enviar al MiniPC:

```text
http://IP_DEL_MINIPC:3000/webhook/playnite
```

El script incluido se llama `playnite-before-game-start.ps1`. Modifica únicamente `$serverUrl` con la IP real del MiniPC antes de pegarlo/configurarlo en Playnite.

## Datos recibidos

El endpoint acepta el payload del prototipo:

- `title`
- `platforms`
- `developers`
- `publishers`
- `genres`
- `releaseYear`
- `playtime`
- `cover` (Data URI Base64)
- `background` (Data URI Base64)

El límite de JSON se ha ampliado a **35 MB** para admitir carátula y fondo embebidos. Las imágenes sólo se mantienen en RAM como parte del último evento y no se guardan en el histórico de notificaciones.

## Comportamiento visual

1. Playnite realiza `POST /webhook/playnite` antes de abrir el juego.
2. El servidor normaliza los datos y envía `game:update` + `view:show` por WebSocket.
3. El frontend muestra `game-now-playing` durante 5 segundos.
4. La barra inferior indica el tiempo restante.
5. Se aplica fundido AMOLED a negro; cuando termina, vuelve internamente al dashboard.
6. Un refresco manual siempre arranca en el Centro de notificaciones, no reabre un popup previo.

## Rutas principales

- `POST /webhook/playnite` — inicio de un juego Playnite.
- `POST /webhook` y `POST /webhook/tautulli` — Tautulli.
- `POST /webhook/arr` — Sonarr/Radarr unificado.
- `GET /api/health` — diagnóstico.
- `GET /api/notifications?page=1&limit=5` — histórico persistente.

## Despliegue

No añade dependencias NPM nuevas. Puedes sustituir el proyecto actual, conservar `.env` y el directorio `data/`, y reconstruir el contenedor en Portainer.
