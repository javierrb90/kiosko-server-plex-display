# Iteración · Dashboard, vídeos e interacción

Cambios incluidos:

- Los items de colección con vídeo pueden marcar `videoFinishBeforeNext` para que el Dashboard espere al final del vídeo antes de pasar al siguiente elemento.
- La opción se puede configurar al subir un item a colección y al editarlo desde Admin.
- La cola del Dashboard evita repeticiones inmediatas recordando los últimos elementos mostrados.
- La barra de progreso del Dashboard se actualiza con `requestAnimationFrame` para un movimiento más fluido.
- Se corrige el botón de limpiar contenido actual evitando que los snapshots repueblen la vista con el último Plex/Game antiguo.
- Se recupera y refuerza la animación de paneo de fondos del Dashboard.
- Los backdrops de items se muestran con blur/opacidad para disimular baja calidad, sin afectar a wallpapers directos.
- Se ajusta el layout de carátula/texto para evitar solapes en pantallas pequeñas.
- Se refuerza el estilo de botones en modales de selección/acción.
