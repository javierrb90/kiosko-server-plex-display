# BBQ v7.1.2

## Base de datos

La cabecera incorpora una botonera contextual para mostrar u ocultar rápidamente cuatro segmentos: Sin organizar, Backlog, On Deck y Colección. El estado se conserva durante la sesión y se combina con búsqueda, tipos y grupos.

## Identidad y espacios Plex

Las operaciones de Backlog y On Deck comparan la identidad estable de Plex, no solo el `canonicalId` literal. Al mover un elemento se eliminan todas las representaciones equivalentes del espacio anterior. La sincronización garantiza que un ítem no pueda quedar simultáneamente en Backlog y On Deck.
