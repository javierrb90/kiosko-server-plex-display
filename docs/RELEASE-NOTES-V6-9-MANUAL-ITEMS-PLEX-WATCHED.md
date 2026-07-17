# v6.9 · Manual Items + Plex Watched Activity

## Nuevo

- Procesamiento de eventos de Plex/Tautulli de contenido visto:
  - si el item no existe, se añade a Base de datos;
  - si existe, actualiza su última actividad;
  - si el item está seguido en Backlog, se actualiza su posición;
  - no se califica ni se mueve automáticamente.
- En series, el detalle distingue actividad:
  - episodios añadidos: `... · añadido`;
  - episodios vistos: `... · terminado`.
- Creación manual de items desde Base de datos:
  - botón `＋` junto al título de la vista;
  - modal con previsualización tipo ficha;
  - carátula, backdrop, título, detalle y tipo.
- Items creados por Kiosko:
  - fuente interna `kiosko`;
  - se pueden editar desde el menú de la ficha;
  - edición de título, detalle, tipo, carátula y backdrop.

## Decisiones

- Los items manuales sólo se crean desde Base de datos.
- No se añaden automáticamente a Backlog, On Deck ni Colecciones.
- El usuario decide después qué hacer con ellos.

## Service worker

```text
kiosko-v6-9
```
