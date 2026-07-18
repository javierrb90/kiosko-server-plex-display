# Terminología oficial de BBQueue

Esta terminología es la referencia para interfaz, documentación y código nuevo.

## Item
Entidad única de la biblioteca: juego, película, serie, libro u otro tipo personalizado.

## Biblioteca
Registro permanente de todos los items conocidos. Un item no desaparece de la biblioteca al salir de un espacio de trabajo.

## Espacio de trabajo
Segmento fijo de la biblioteca con presentación y organización propias. Los espacios incluidos son:

- **Base de datos:** todos los items.
- **Backlog:** items añadidos manualmente a la lista de pendientes.
- **On Deck:** selección manual activa, con límite por tipo.
- **Colección:** items marcados como **Terminados**.

Las reglas de pertenencia de estos espacios son fijas. El usuario puede cambiar su presentación, agrupación y orden.

## Colección
Nombre singular del espacio de items terminados. No debe utilizarse como sinónimo de grupo.

La calificación y la review son independientes: un item puede tener ambas sin estar terminado, y puede estar terminado sin calificación.

## Grupo
Etiqueta transversal para organizar y filtrar items. Puede ser manual, dinámico o mixto. Un grupo:

- no es un espacio de trabajo;
- no cambia el estado Terminado;
- no mueve items a Colección;
- puede contener items de cualquier espacio.

## Presentación
Configuración persistente del aspecto de un espacio: Grid o Lista, diseño Simple o Normal, tamaño e items por página.

## Organización
Configuración persistente de agrupación, criterio de orden y dirección.

## Filtro
Restricción temporal sobre el espacio actual. Los filtros por tipo, grupo o parrilla no modifican la pertenencia ni la configuración persistente.

## Detalle o estado visible
Texto orgánico que resume la última actividad relevante del item. Las integraciones pueden volver a actualizarlo.

## Última actividad
Fecha y hora usada para ordenar y calcular la parrilla. Debe conservar precisión de hora, minutos y segundos.

## Parrilla
Sistema de atención basado en la última actividad y en los límites del espacio actual.

- **Normal:** dentro del periodo esperado.
- **Quemándose:** se aproxima al límite.
- **Achicharrado:** ha superado el límite o fue marcado manualmente.

El cálculo depende del espacio: al mover un item se actualiza su actividad y se aplican los límites del nuevo espacio.

## Review
Opinión única asociada al item. Es independiente del diario, la calificación y el estado Terminado.

## Diario
Historial de anotaciones vinculadas a actualizaciones de actividad. Cada entrada puede incluir texto e imagen.
