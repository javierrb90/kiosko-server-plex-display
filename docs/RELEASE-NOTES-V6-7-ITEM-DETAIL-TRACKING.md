# Release notes · Kiosko Media Center v6.7 · Item Detail & Tracking

## Objetivo

v6.7 cierra el cambio de modelo iniciado en v6.6: Base de datos es el índice permanente, Backlog pasa a ser seguimiento manual de actividad, On Deck es un destacado temporal y Colecciones reúne los items calificados.

## Cambios de modelo

- Backlog ya no se llena automáticamente con todo lo que entra.
- Backlog ahora significa “seguir actividad”.
- Si un item seguido recibe actividad nueva, sube al Backlog y actualiza su fecha/detalle.
- Playnite, Plex y Tautulli actualizan siempre Base de datos en tiempo real.
- Series, temporadas y episodios se consolidan sobre la entidad serie.
- On Deck y Colecciones ya no son excluyentes.
- Calificar un item no lo retira automáticamente de On Deck.

## Ficha del item

- UI reorganizada con acciones rápidas contextuales.
- Botón de edición reducido a icono.
- Acciones destructivas/secundarias movidas al menú `…`.
- Eliminar definitivamente está disponible desde cualquier vista, pero sólo en el menú `…` y con confirmación.
- El botón grande “Añadir al Backlog” desaparece.
- El botón grande “Diseño ficha” desaparece.
- Diseño de ficha se mueve a Opciones → Ficha.

## Acciones por contexto

### Base de datos

- Seguir en Backlog / Dejar de seguir.
- Añadir a On Deck / Quitar de On Deck.
- Editar item.
- Eliminar definitivamente desde el menú `…`.

### Backlog

- Quitar del Backlog.
- Añadir a On Deck / Quitar de On Deck.
- Editar item.
- Eliminar definitivamente desde el menú `…`.

### On Deck

- Seguir en Backlog / Quitar del Backlog.
- Quitar de On Deck.
- Editar item.
- Eliminar definitivamente desde el menú `…`.

### Colecciones

- Quitar de Colecciones.
- Esto retira rating/completedAt, pero mantiene el item en Base de datos y no lo borra de On Deck/Backlog.
- Eliminar definitivamente desde el menú `…`.

## Configuración

- Nueva pestaña `Ficha` en Opciones.
- Controles de diseño del modal de ficha:
  - fondo: backdrop, poster, sólido o ninguno;
  - oscurecimiento;
  - blur.
- Metadata visible configurable por tipo:
  - juegos;
  - películas;
  - series.
- Nueva chuleta de metadata detectada mediante `GET /api/items/metadata-keys`.
- La paginación de cada vista vive en sus propios filtros.

## API nueva/ajustada

```text
GET    /api/items/metadata-keys
POST   /api/items/:canonicalId/backlog
DELETE /api/items/:canonicalId/backlog
POST   /api/items/:canonicalId/deck
DELETE /api/items/:canonicalId/deck
POST   /api/items/:canonicalId/complete
DELETE /api/items/:canonicalId/collection
POST   /api/items/:canonicalId/delete
```

## Correcciones incluidas

- Los juegos nuevos de Playnite refrescan Base de datos en tiempo real.
- Los deltas WebSocket incluyen el estado completo necesario para sincronizar vistas.
- Quitar de Colecciones elimina rating y completedAt del registry.
- El reemplazo de On Deck conserva el nuevo modelo de Backlog como seguimiento.
- El límite de 15 del Backlog queda eliminado: sólo hay paginación visual.

## Service worker

```text
kiosko-v6-7
```
