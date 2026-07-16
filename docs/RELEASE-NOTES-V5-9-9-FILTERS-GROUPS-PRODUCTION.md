# v5.9.9 · Filtros por grupos y producción

- Buscador visible también en Backlog y On Deck.
- Filtros por grupos en Backlog y On Deck.
- Click en chip de grupo dentro de una tarjeta filtra la vista actual por ese grupo.
- Indicador visual de filtros activos bajo el título de la vista.
- Chips de grupo con hover/click.
- El buscador de Colecciones ya no duplica etiqueta.
- Fix crítico: `collectionGroupStore.init()` se incluye en el arranque, por lo que `data/collection-groups.json` se carga al reiniciar/cambiar versión.
- Logs de arranque reducidos para producción:
  - puerto;
  - DATA_DIR;
  - URL local sugerida;
  - endpoints de diagnóstico.
- El log HTTP queda desactivado salvo `DEBUG_HTTP=1`.
