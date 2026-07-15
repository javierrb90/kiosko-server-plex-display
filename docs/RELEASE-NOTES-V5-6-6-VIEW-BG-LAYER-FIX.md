# v5.6.6 · Capa de fondos por vista

- Las vistas `section[data-view]` pasan a ocupar el viewport completo.
- El fondo queda anclado al `section` de la vista, no al alto del `div` interno.
- Refuerzo específico para On Deck con `data-bg-owner="on-deck"` y fallback de `background-image` inline.
- Backlog/Colecciones también reciben fallback de `background-image` inline.
- Corregida la banda negra provocada por fondos ligados a contenedores sin altura completa.
