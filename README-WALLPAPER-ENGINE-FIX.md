# Wallpaper Engine · corrección de modales y guardado

Esta versión corrige dos puntos que podían bloquear o hacer caer Wallpaper Engine:

1. Las imágenes de Playnite ya no se reenvían al navegador como Base64 para guardarlas en wallpapers/colecciones. Al recibir el webhook, el backend las persiste primero en `data/assets/playnite/` y el frontend trabaja con rutas locales `/assets/...`.
2. Las vistas ocultas de Settings y Collections ya no renderizan ni cargan imágenes cuando reciben actualizaciones por WebSocket. Sólo actualizan datos en memoria y renderizan cuando están visibles.

También se ha simplificado el listado de wallpapers en Settings para evitar cargar miniaturas pesadas dentro de Wallpaper Engine.
