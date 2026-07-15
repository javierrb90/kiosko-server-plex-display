# Release notes · v5.3 Clean UI

Esta iteración limpia la transición de kiosko/dashboard a app de gestión multimedia.

## UI

- Dock movido junto a la campana de notificaciones, en la esquina superior izquierda.
- Controles de vista movidos a la esquina superior derecha.
- Títulos de sección reducidos a `Backlog N` y `Colecciones N`.
- Backlog y Colecciones usan grids reales alineados al inicio.
- Añadida búsqueda rápida en Backlog y Colecciones.
- Paginación por flechas con indicador `página/total`.
- Eliminado oscurecimiento automático.
- Eliminado Dashboard como vista.

## Configuración

- Opciones integradas en modal dentro de la app.
- Eliminado `/admin.html`.
- Eliminadas opciones antiguas de wallpapers, dashboard y colecciones manuales.
- Panel de fuentes de Backlog mantenido y simplificado.

## Lógica

- La vista inicial configurada tiene prioridad al abrir la app.
- Plex/Playnite actualizan la vista Actual, pero ya no fuerzan navegación automática.
- Backend simplificado: sin stores/endpoints legacy de wallpapers o colecciones manuales.
