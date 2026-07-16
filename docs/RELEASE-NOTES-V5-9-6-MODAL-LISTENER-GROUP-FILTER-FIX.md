# v5.9.6 · Fix listeners, grupos y filtros

- Evita listeners acumulados en el modal de ficha usando AbortController.
- Evita acciones múltiples al puntuar o pulsar botones mediante estado `busy`.
- El selector de grupos ya no abre otro modal encima: se muestra inline dentro de la ficha.
- El botón `+` permite abrir el selector inline y guardar grupos.
- Se refrescan grupos desde `/api/collection-groups` antes de mostrarlos y después de guardarlos.
- Los filtros por grupo manual usan fallback por:
  - id;
  - canonicalId;
  - gameId;
  - ratingKey.
- El backend guarda también `manualItemKeys` para que la pertenencia sobreviva a cambios de contexto/id.
- Reduce toasts duplicados y evita saltos de vista provocados por acciones múltiples.
