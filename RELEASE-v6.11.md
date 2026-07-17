# Kiosko Media Center v6.11

## Diario y reviews

- Diario independiente por item con entradas de hasta 140 caracteres.
- Actualización manual de actividad con detalle opcional, comentario e imagen.
- Imágenes mediante selector, arrastrar y soltar o pegado desde portapapeles.
- Almacenamiento de imágenes en `/assets/journals`; el JSON solo guarda la ruta.
- Vista de diario dentro de la ficha, manteniendo la carátula visible.
- Paginación de 8 entradas, edición, eliminación y visor ampliado de imágenes.
- Contador de entradas en las tarjetas del grid.
- Review independiente de la calificación y persistente al salir de Colecciones.
- Invitación opcional a escribir review después de calificar.
- Actualización en tiempo real mediante el evento `item:journal-updated`.

## Reglas

- Crear una entrada actualiza la última actividad del item.
- Editar o borrar una entrada antigua no actualiza la actividad.
- La review no cuenta en el contador del diario.
- Editar o borrar la review no cambia la calificación ni la actividad.
- Las imágenes admitidas son JPEG, PNG y WebP, con un máximo de 5 MB desde la interfaz.
