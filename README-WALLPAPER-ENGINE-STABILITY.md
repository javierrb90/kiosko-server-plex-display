# Ajuste de estabilidad para Wallpaper Engine

Esta versión elimina de Settings y Collections los layouts con CSS Grid/auto-fill/minmax y sustituye Collections por un masonry calculado en JavaScript con columnas flex.

Motivo: Wallpaper Engine cargaba correctamente la app base, pero fallaba al activar Settings, Collections o tras guardar assets. El patrón común era la activación/render de vistas con layouts complejos. Esta build usa CSS más conservador en esas zonas.

Cambios:
- Settings usa flex-wrap en lugar de CSS Grid.
- Collections usa columnas flex generadas por JavaScript.
- Se mantiene el aspect ratio de cada imagen con `width:100%; height:auto`.
- Se elimina `localStorage` de Collections para evitar persistencia del navegador embebido.
- Se elimina `loading="lazy"` en imágenes de colección.
- Los botones L / XL / XXL / Todos cambian el número de columnas calculado.
