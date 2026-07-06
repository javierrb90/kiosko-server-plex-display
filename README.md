# Kiosko Media Center

## Configuración

Copia `.env.example` como `.env` y completa `PLEX_URL` y `PLEX_TOKEN`.

El proyecto no usa `dotenv`: Node 22 carga `.env` de forma nativa al ejecutar `npm start`.

En Docker/Portainer, `docker-compose.yml` también inyecta el mismo archivo mediante `env_file`.


## Endpoints Tautulli

Se admiten ambas URLs para compatibilidad:

- `POST /webhook` (configuración original)
- `POST /webhook/tautulli` (ruta nueva)

Para comprobar manualmente que el centro de notificaciones funciona:

```bash
curl -X POST http://localhost:3000/api/notifications/test \
  -H "Content-Type: application/json" \
  -d '{"title":"Prueba","subtitle":"El dashboard recibe eventos"}'
```

## Webhook unificado de Sonarr y Radarr

Configura una conexión de tipo **Webhook** en ambas aplicaciones con la misma URL y método `POST`:

```text
http://IP_DEL_MINIPC:3000/webhook/arr
```

El servidor detecta automáticamente el origen a partir del payload nativo:

- Si contiene `movie`, se trata como Radarr.
- Si contiene `series`, `episode` o `episodes`, se trata como Sonarr.
- Para `On Grab`, utiliza también esas estructuras para distinguirlos.

Activa únicamente:

- **Sonarr:** `On Grab` y `On Series Add`.
- **Radarr:** `On Grab` y `On Movie Add`.

Al pulsar **Test**, ambas aplicaciones reciben `200 OK`; ese evento no crea notificación. Los eventos distintos de los seleccionados también responden `200 OK`, se registran en consola y se ignoran.

Las rutas anteriores siguen funcionando por compatibilidad:

```text
/webhook/arr/sonarr
/webhook/arr/radarr
```


## Comportamiento de vistas

- Al arrancar, el kiosko abre siempre el **Centro de notificaciones**, aunque todavía esté vacío.
- Las notificaciones de Sonarr, Radarr y elementos añadidos a Plex actualizan esa vista.
- La pantalla Plex sólo se abre con eventos de reproducción (`play`, `resume` o `start`).
- Con `pause` o `stop`, vuelve al Centro de notificaciones.


## Diagnóstico de Tautulli

Al recibir una reproducción, el log debe incluir `Evento Tautulli normalizado` con `startsPlayback: true` y después `Vista activa solicitada: plex-now-playing`. Si no aparece, revisa el valor real que manda Tautulli en `eventType`; esta versión admite play, start, resume y las variantes Playback Start/Resume.

## Vista de reproducción temporal

La vista de Plex se abre solamente al recibir `play`, `start` o `resume` desde Tautulli. Se muestra durante 5 segundos y vuelve al centro de notificaciones. Cada evento nuevo de reproducción reinicia el contador. La barra inferior indica el tiempo restante.

## Diagnóstico de la vista Plex

Esta versión registra trazas en la consola del navegador con el prefijo `[Kiosko UI]`.

En Android puedes verlas conectando el móvil por USB y abriendo `chrome://inspect` desde Chrome en un ordenador, o usando la consola remota del navegador kiosko si la ofrece.

Al reproducir contenido, deberían aparecer en este orden aproximado:

```text
[Kiosko UI] Mensaje WebSocket recibido plex:update
[Kiosko UI] Mensaje WebSocket recibido view:show
[Kiosko UI] Abriendo popup temporal de Plex
[Kiosko UI] Cambiando vista { from: 'notifications', to: 'plex-now-playing' }
```


## Comportamiento de reproducción

El popup temporal de Plex sólo se abre con eventos `play` o `start` (incluyendo variantes `Playback Start`). El evento `resume` se acepta pero no abre ni reinicia el popup.

## Ajuste visual (pantalla 960×540)
- El centro muestra siempre 5 notificaciones por página.
- La primera tarjeta se destaca como evento más reciente.
- La vista Plex usa un póster casi a pantalla completa y tipografías ampliadas.

## Modo reposo AMOLED

La aplicación arranca con una capa negra de reposo sobre toda la pantalla. En paneles AMOLED esto evita iluminar píxeles y simula la pantalla apagada.

- Un webhook de Arr/Tautulli despierta el kiosko automáticamente.
- Una notificación muestra el dashboard durante 30 segundos; el valor se puede cambiar en `public/app.js` con `DASHBOARD_AWAKE_DURATION_MS`.
- Un evento de reproducción de Plex se muestra 5 segundos y vuelve a negro al terminar.
- El botón `⏻` del dashboard apaga manualmente la pantalla.
- Con la pantalla negra, tocar cualquier punto vuelve a encender el dashboard.


## Ajuste de fundido AMOLED
Al terminar el popup de Plex, la capa negra se activa primero. El dashboard se cambia sólo cuando termina la transición `opacity` de 700 ms (o tras un fallback de 850 ms en navegadores Android que no emitan `transitionend`).
