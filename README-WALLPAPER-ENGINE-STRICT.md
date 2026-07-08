# Wallpaper Engine strict-safe build

Esta variante evita los elementos que estaban provocando cierres en Wallpaper Engine:

- No hay `input type=file` dentro de las vistas del dock.
- Settings dentro del kiosko es una vista segura/read-only con resumen de estado.
- Collections ya no usa `<select>` ni inputs de subida; usa botones anterior/siguiente.
- Subidas manuales de wallpapers, subidas a colecciones y CSS avanzado quedan en `/admin.html`, pensado para abrirse desde un navegador normal de la LAN, no desde Wallpaper Engine.

La app principal mantiene:

- Dashboard con wallpapers.
- Plex/Game persistentes.
- Collections con masonry y aspect ratio preservado.
- Modales/toasts propios.
- Añadir backdrop/fondo a wallpapers desde Plex/Game.
- Añadir poster/carátula a colecciones desde Plex/Game.
