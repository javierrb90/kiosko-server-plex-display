# Visión y terminología

## Objetivo

BBQueue centraliza contenido procedente de integraciones y entradas manuales. Todos los elementos viven en una biblioteca única y se muestran mediante espacios de trabajo fijos.

## Términos oficiales

- **Ítem**: entidad única de contenido. Puede ser película, serie, juego o un tipo personalizado.
- **Base de datos**: vista completa de la biblioteca.
- **Backlog**: segmento manual de elementos pendientes.
- **On Deck**: segmento manual y limitado de elementos prioritarios.
- **Colección**: elementos marcados como terminados. Es singular en toda la interfaz.
- **Grupo**: etiqueta organizativa independiente de Colección.
- **Detalle / estado**: texto orgánico que explica la última actividad relevante del ítem.
- **Actividad**: fecha y evento que representan el último uso o actualización relevante.
- **Diario**: entradas cronológicas de hasta 140 caracteres, con imagen opcional.
- **Review**: opinión independiente de la calificación y de Terminado.
- **Terminado**: marca que determina la pertenencia a Colección.
- **Quemándose**: condición calculada por inactividad próxima al límite.
- **Achicharrado**: condición calculada al superar el límite o marca manual persistente.

## Compatibilidad heredada

El identificador interno de origen `kiosko` se mantiene para no romper datos antiguos. En la interfaz se presenta como contenido manual de BBQueue. No debe usarse como nombre de producto nuevo.
