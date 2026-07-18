# Modelo de dominio

## Identidad

Cada ítem usa un `canonicalId` estable. Ejemplos:

- `playnite:<game-id>`
- `plex:movies:<rating-key>`
- `plex:series:<rating-key>`
- `manual:<uuid>`

`items.id` es una clave interna de SQLite y no debe derivarse de identificadores externos. El repositorio conserva el ID interno asociado a un `canonicalId` ya existente y asigna un UUID a elementos nuevos.

## Espacios

### Base de datos

Contiene todos los ítems. No es un estado excluyente, sino la vista del catálogo completo.

### Backlog

Contenido pendiente. Puede coexistir históricamente con On Deck, aunque las acciones normales deben mantener un flujo coherente.

### On Deck

Contenido activo o prioritario. Mover un ítem aquí puede retirarlo de Colección si estaba terminado.

### Colección

Contenido terminado. Al completar un ítem se registra `completedAt`, se navega a Colección y puede lanzarse confeti desde la tarjeta o fila de destino.

## Grupos

Los grupos son etiquetas del usuario y son transversales a los espacios. Se usan para filtrar o agrupar. El término “colecciones” no debe emplearse para ellos.

## Actividad

`lastActivityAt` representa la última interacción significativa. Puede actualizarse por:

- reproducción o visionado en Plex;
- inicio de un juego en Playnite;
- entrada manual desde la ficha;
- botón Dar la vuelta.

## Parrilla

Los límites se configuran por tipo y espacio. El estado derivado puede ser:

- normal;
- Quemándose;
- Achicharrado.

Dar la vuelta actualiza la actividad. El control rápido solo tiene sentido en Backlog y On Deck.

## Valoración, reseña y diario

- `rating`: valoración numérica.
- review: reseña principal asociada al ítem.
- journal: entradas de actividad o comentarios con fecha.

## Assets

Poster, fondo y adjuntos son referencias a archivos o URL. Nunca deben persistirse como Data URI en SQLite.
