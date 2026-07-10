# Iteración: edición completa de items de colección

Esta versión corrige el panel de administración de colecciones para que los items no sólo permitan editar el título.

## Cambios

- Nuevo modal de edición de item en `/admin.html`.
- Edición de título.
- Reemplazo de portada/carátula.
- Reemplazo de backdrop/fondo.
- Reemplazo de vídeo/trailer.
- Eliminación de backdrop actual.
- Eliminación de vídeo actual.
- El endpoint existente `PATCH /api/collections/:id/items/:itemId` se reutiliza y ya soportaba estos campos.

## Campos aceptados por PATCH

```json
{
  "title": "Nuevo título",
  "image": "data:image/...",
  "backdropImage": "data:image/... | null",
  "video": "data:video/... | null"
}
```

