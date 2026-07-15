# v5.6.8 · Fondo On Deck por CSS variable

- On Deck ya no depende del `div.section-bg` interno para pintar el fondo.
- El fondo se asigna como variable CSS `--view-bg-image` sobre `section[data-view="on-deck"]`.
- La vista pinta el fondo con `::before` y la capa de oscurecimiento con `::after`.
- Quitada la etiqueta `On Deck` dentro de los items de la propia vista On Deck.
