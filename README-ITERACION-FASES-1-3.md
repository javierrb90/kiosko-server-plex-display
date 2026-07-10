# Iteración fases 1, 2 y 3

Esta versión toma la última base del proyecto y aplica las tres primeras fases de evolución:

## Fase 1: Contenido actual unificado

- Plex y Playnite dejan de ser vistas separadas.
- Nueva vista única `current-content` para el último contenido activo.
- El dock queda reducido a `Dashboard`, `Actual` y `Colecciones`.
- Los webhooks de Plex y Playnite siguen funcionando igual, pero ambos actualizan `currentContent`.
- Añadido `POST /api/current/clear` para limpiar el contenido actual.
- La vista Actual mantiene acciones para añadir fondo a wallpapers y portada a colección.

## Fase 2: Dashboard multimedia

- El Dashboard sigue rotando entre wallpapers y colecciones seleccionadas.
- Los items de colección usan un layout ambiental con backdrop, portada grande y datos mínimos.
- Se mantiene el fade y el movimiento sutil del fondo.
- Se aplican tratamientos visuales a fondos de items para disimular baja resolución.
- Se mantiene el swipe horizontal para cambiar de fondo.

## Fase 3: Vídeos unificados

- Los wallpapers pueden ser imágenes/GIFs o vídeos MP4/WebM.
- Cada vídeo puede tener audio opcional y volumen propio.
- Añadida opción `finishBeforeNext` por wallpaper de vídeo para esperar a que termine antes de rotar.
- La barra de progreso del Dashboard refleja el temporizador normal o el progreso real del vídeo si se espera al final.

## Notas

- Se prepara el modelo visual para futuros `display skins` sin implementarlos todavía.
- `.env` no se incluye en el ZIP final. Configura Plex desde `/admin.html` o desde variables de entorno si lo prefieres.
- El `docker-compose.yml` usa el volumen externo `kiosko_volume`.
