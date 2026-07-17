# v6.10 · Custom Types + Manual Edit Fix

## Corregido

- La edición de items manuales ahora persiste correctamente título, detalle, tipo, carátula y backdrop.
- Si el item manual ya estaba en Backlog, On Deck o Colecciones, también se actualizan las copias legacy para que la sincronización no revierta los cambios.

## Nuevo

- Nueva sección `Tipos` dentro de Opciones.
- Permite crear tipos personalizados, por ejemplo:
  - Libro / Libros
  - Manga / Mangas
  - Podcast / Podcasts
- Los tipos personalizados aparecen en:
  - filtros de vistas;
  - formulario de creación de item;
  - edición de datos principales de items manuales.
- Los items pueden guardar `collectionType` personalizado.

## Decisiones

- Juegos, Películas y Series siguen siendo tipos base.
- Los tipos personalizados afectan principalmente a items creados desde Kiosko.
- La creación de items sigue limitada a Base de datos.

## Service worker

```text
kiosko-v6-10
```
