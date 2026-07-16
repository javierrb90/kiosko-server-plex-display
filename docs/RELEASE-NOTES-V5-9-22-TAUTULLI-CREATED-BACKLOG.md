# v5.9.22 · Tautulli created → Backlog

## Cambios

- Tautulli `created` ahora se interpreta como contenido añadido a biblioteca.
- Los episodios nuevos entran en Backlog como novedad de episodio.
- Si la serie ya está en On Deck, el episodio igualmente entra en Backlog.
- La tarjeta del Backlog muestra aviso:
  - `Serie en On Deck`
- Al añadir ese episodio al On Deck, el servidor sigue canonicándolo a la serie.
- Añadidas trazas específicas:
  - `[tautulli] backlog candidate`
  - `[tautulli] backlog upserted`
  - `[tautulli] backlog skipped`
- Añadido evento delta:
  - `item:backlog-upserted`
- El frontend actualiza el Backlog en vivo con ese delta.
- `node --check` e import ESM validados.
