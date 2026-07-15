# Kiosko Media Center v5.4.1 · Caché local de assets Plex

## Cambios

- Las portadas y backdrops de Plex ya no se entregan al frontend como URLs directas de Plex con `X-Plex-Token`.
- Al recibir metadata desde Tautulli/Plex, el servidor descarga la portada y el backdrop una vez y los guarda en `data/assets/plex`.
- El Backlog, Actual, Colecciones y las notificaciones pasan a usar rutas locales `/assets/plex/...`.
- La caché usa nombres deterministas basados en hash para evitar volver a descargar la misma imagen.
- Se conserva internamente la URL original en `meta.originalPosterUrl` y `meta.originalBackdropUrl` para depuración.

## Ventajas

- Carga más rápida de carátulas tras la primera descarga.
- Menos peticiones repetidas a Plex.
- El token de Plex deja de aparecer en las URLs visibles del navegador.
- Las imágenes siguen funcionando aunque Plex tarde más en responder, siempre que ya estén cacheadas.

## Nota

Los items que ya estuvieran guardados en `data/backlog.json` con URLs directas antiguas no se convierten automáticamente. Se irán normalizando al volver a entrar por webhook/evento, o se puede limpiar el backlog y dejar que se regenere.
