# Kiosko Media Center v4 · Wallpaper Engine safe build

Esta variante elimina físicamente del CSS base las reglas que podían provocar el fallo `status_illegal_instruction` en el Chromium embebido de Wallpaper Engine.

Cambios de compatibilidad aplicados:

- Sin `animation` ni `@keyframes`.
- Sin `transition`.
- Sin `filter`, `blur` ni `backdrop-filter`.
- Sin `transform`, `translate3d`, `scale` ni transformaciones 3D.
- Sin `will-change`.
- Sin `radial-gradient` ni fondos complejos.
- Sin `clamp`.
- Sin CSS columns para la galería.
- Dock sin emojis, usando letras simples.
- Dashboard y fondos de Plex/Game usan `<img>` en vez de `background-image`.
- La galería usa grid seguro y mantiene el aspect ratio de cada imagen con `width:100%; height:auto`.

Páginas de diagnóstico incluidas:

- `/we-test-1.html`: HTML/CSS mínimo.
- `/we-test-2.html`: prueba de imagen `<img>` simple.
- `/we-test-3.html`: prueba de WebSocket.

Orden de prueba recomendado en Wallpaper Engine:

1. `http://IP:3000/we-test-1.html`
2. `http://IP:3000/we-test-2.html`
3. `http://IP:3000/we-test-3.html`
4. `http://IP:3000/`

Si falla incluso `/we-test-1.html`, el problema no está en la app sino en Wallpaper Engine/CEF/driver/aceleración hardware. Si fallan sólo pasos posteriores, se puede aislar mejor el punto exacto.
