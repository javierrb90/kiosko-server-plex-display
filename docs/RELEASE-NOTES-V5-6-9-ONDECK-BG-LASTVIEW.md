# v5.6.9 · On Deck fondo real y última vista

- On Deck deja de usar la estrategia experimental de fondo por pseudo-elemento.
- On Deck usa ahora la misma estructura que Backlog/Colecciones: `.app-section > .section-bg[data-dynamic-bg]`.
- Corregido que `.app-section` tapase el fondo de On Deck.
- El backend inicializa `runtime.activeView` desde `stateStore.activeView`.
- `/api/state` actualiza también `runtime.activeView` cuando cambia la vista.
- El frontend deja de forzar Backlog al arrancar.
- Al refrescar, se restaura la última vista activa guardada.
