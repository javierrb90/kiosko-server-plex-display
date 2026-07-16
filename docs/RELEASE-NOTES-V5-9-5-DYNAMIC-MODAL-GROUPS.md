# v5.9.5 · Ficha dinámica y grupos en modal

- El botón `+` de grupos en la ficha vuelve a funcionar.
- El selector de grupos avisa si no hay grupos creados o si el item todavía no está guardado en Colecciones.
- La ficha de item ahora se re-renderiza dentro del propio modal tras acciones:
  - Backlog → On Deck;
  - On Deck → Backlog;
  - Backlog/On Deck/Actual → Colecciones al puntuar;
  - eliminado del contexto actual.
- Los botones del modal cambian según el estado actual del item, sin cerrar el modal ni cambiar de vista.
- Las acciones del modal se renderizan dentro de la ficha, no en el footer estático, para poder actualizarlas dinámicamente.
