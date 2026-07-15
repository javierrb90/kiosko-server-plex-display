# v5.6 · On Deck, Actual y notificaciones compactas

- Nueva vista **On Deck** para contenido que quieres tener controlado ahora.
- Flujo Backlog → On Deck → Colecciones.
- Recuperada la vista **Actual** como vista de acciones rápidas.
- Actual no roba la navegación: cuando entra reproducción/juego aparece un toast y sólo se navega a Actual si se pulsa.
- Acciones desde Actual:
  - añadir a On Deck;
  - marcar visto/terminado;
  - limpiar actual.
- On Deck se puebla sólo por acción manual desde Backlog o Actual.
- Al pasar algo a Colecciones se elimina de On Deck.
- Al pasar algo a On Deck se retira de Backlog y de Colecciones para evitar estados duplicados.
- En Actual se muestra un único estado: `On Deck` o estrellas de valoración, nunca ambos.
- Responsive móvil: Backlog, On Deck y Colecciones vuelven a grid vertical compacto de carátulas.
- Centro de notificaciones más compacto y casi full-height en móvil.
- Toasts comunes para notificaciones y reproducción actual.
