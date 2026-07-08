# Kiosko Media Center v4 · Modales compatibles con Wallpaper Engine

Cambios de esta versión:

- Eliminados los `alert()`, `confirm()` y `prompt()` nativos del navegador en la UI.
- Añadido `public/core/ui.js` con componentes propios:
  - `ui.toast()`
  - `ui.alert()`
  - `ui.confirm()`
  - `ui.prompt()`
  - `ui.chooseCollection()`
  - `ui.actionSheet()`
- Plex y Playnite/Game ya no muestran botones permanentes para guardar assets.
- En Plex y Game aparece un botón `...` en la esquina superior derecha.
- Ese botón abre un modal de acciones:
  - Añadir backdrop/fondo a wallpapers.
  - Añadir póster/carátula a colección.
- Al añadir a colección se abre un modal para elegir colección existente o crear una nueva.
- Collections y Settings también usan modales/toasts propios para confirmaciones y errores.

La idea es mantener la vista de Plex/Game limpia y evitar diálogos nativos problemáticos dentro de Wallpaper Engine.
