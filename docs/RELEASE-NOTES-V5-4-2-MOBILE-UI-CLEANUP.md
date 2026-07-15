# Kiosko Media Center v5.4.2

Refactor menor de UI móvil y controles de vista.

## Cambios

- Los controles de Backlog y Colecciones dejan de estar siempre visibles en la parte superior.
- Se sustituyen por un botón compacto de filtros/vista.
- Filtros, tamaño de carátula y búsqueda pasan a un modal.
- Los filtros muestran contador por tipo:
  - Películas
  - Juegos
  - Series
- La botonera superior queda más limpia en móvil:
  - campana
  - navegación
  - configuración
  - controles de la vista actual
- La zona de contenido ya no queda tapada por los controles superiores.
- Backlog y Colecciones permiten scroll vertical para evitar que los últimos items de una página queden cortados.
- La paginación se mantiene mediante flechas e indicador de página.
- Se mantiene el guardado en sesión de filtros, búsqueda, página y tamaño.

## Validación

Se ha validado la sintaxis de los archivos JavaScript del proyecto con `node --check`.
