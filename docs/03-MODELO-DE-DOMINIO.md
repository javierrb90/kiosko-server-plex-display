# Modelo de dominio

## Ítem canónico

Campos importantes observados en el código:

- `canonicalId`: identidad estable.
- `source`: `plex`, `playnite`, `kiosko` o `manual`.
- `sourceId` / `id`: identidad del origen.
- `title`, `subtitle`, `detail`.
- `collectionType`: tipo normalizado.
- `poster`, `backdrop` y metadatos.
- `firstSeenAt`, `lastActivityAt`, `completedAt`, `updatedAt`.
- `rating`: 1–5 o nulo.
- `states.inBacklog`, `states.inOnDeck`, `states.completed`, `states.charred`.

## Reglas de pertenencia

- Backlog y On Deck son mutuamente excluyentes.
- Colección depende de `completedAt` / `states.completed`.
- Mover a Backlog u On Deck elimina Terminado, pero conserva rating y review.
- Base de datos contiene todos los ítems.
- Los grupos no modifican la pertenencia a espacios.

## Series Plex

Los episodios se consolidan en la entidad de serie. El detalle debe conservar el episodio y el evento más reciente, por ejemplo `S01E05 · reproducido`, sin degradarse a `Serie` al cambiar de espacio.

## Parrilla

La parrilla se evalúa en el contexto del espacio actual:

- no aplica a Colección;
- usa `lastActivityAt` y el límite del tipo para Backlog u On Deck;
- Quemándose y el vencimiento automático son calculados;
- `states.charred` permite una marca manual persistente;
- las integraciones pueden decidir si una actividad elimina la marca manual.
