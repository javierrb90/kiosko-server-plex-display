# v6.7.1 · Detail State Cleanup

## Corregido

- Mandar un item al Backlog actualiza `lastActivityAt` al momento actual y registra actividad manual.
- Base de datos recupera filtros por grupos desde el modal de filtros.
- La botonera Juegos / Películas / Series vuelve al modal de filtros.
- La ficha muestra pills globales de estado: tipo, fuente, Backlog, On Deck y Calificado.
- Se elimina el lápiz externo duplicado; el menú de edición usa el icono de lápiz.
- Quitar de Colecciones queda dentro del menú de edición.
- Los botones de seguimiento y Deck se simplifican visualmente.
- La paginación queda anclada al fondo de la vista cuando hay pocos resultados.
- La URL hash cambia con la vista y con el item abierto.
- Los refrescos realtime de Base de datos no se pisan con renders antiguos tras deltas.

## Service worker

```text
kiosko-v6-7-1
```
