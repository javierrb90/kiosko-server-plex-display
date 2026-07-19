# BBQ v7.3.1

Versión de consolidación de ficha y notificaciones.

## Ficha de actividad

- La carátula queda fija y centrada verticalmente.
- Solo el panel informativo derecho tiene desplazamiento.
- Las acciones de formularios se trasladan al pie fijo del modal.
- Guardar una edición mantiene la ficha abierta y vuelve al resumen actualizado.
- Los encabezados internos usan una escala contenida.

## Notificaciones

Desde **Opciones → Notificaciones** se decide qué eventos generan una notificación persistente:

- Plex: contenido añadido.
- Plex: reproducción iniciada.
- Plex: contenido visto.
- Playnite: juego iniciado.

Las opciones de observación de las integraciones siguen controlando la ingestión y actualización de actividades. Las nuevas opciones controlan únicamente si ese evento se conserva como notificación.

El centro guarda las 25 entradas más recientes. Cada entrada referencia una actividad mediante `meta.canonicalId`. Al pulsarla se cierra el panel y se abre la ficha correspondiente.

El toast inferior ya no representa el contenido actual: representa la última notificación recibida. Abrirlo o cerrarlo la marca como leída.
