# v5.9.8 · Grupos en Backlog, On Deck y Colecciones

- El buscador de Colecciones ya no muestra texto duplicado.
- Las tarjetas de Colecciones muestran chips con los grupos del item.
- Las tarjetas de Backlog y On Deck también muestran chips de grupos cuando los haya.
- Las fichas de Backlog, On Deck, Colecciones y Actual muestran grupos y permiten asignarlos con el botón `+`.
- La pertenencia a grupos se guarda con claves estables:
  - canonicalId;
  - id;
  - gameId;
  - ratingKey;
  - claves de serie Plex cuando existen.
- Al quitar un item de un grupo se limpian todas las claves estables asociadas.
- Los grupos dinámicos también se detectan en tarjetas/fichas/toasts.
- Los toasts de contenido actual incluyen el grupo si el item ya pertenece a uno.
- Se mantiene la base diagnostics:
  - logs de IP;
  - `/api/health`;
  - `/api/diagnostics`.
