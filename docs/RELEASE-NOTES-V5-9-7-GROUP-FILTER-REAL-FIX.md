# v5.9.7 · Fix real filtro por grupos

- Corrige el bug principal: `filtered()` no estaba aplicando `itemMatchesActiveGroups`.
- Al abrir filtros de Colecciones, refresca grupos desde `/api/collection-groups`.
- Al aplicar filtros, vuelve a refrescar grupos antes de renderizar.
- Al guardar grupos desde la ficha, dispara evento local para que Colecciones refresque grupos/listado.
- Mantiene fallback de pertenencia por `id`, `canonicalId`, `gameId` y `ratingKey`.
- Mantiene protección contra listeners duplicados y toasts múltiples.
