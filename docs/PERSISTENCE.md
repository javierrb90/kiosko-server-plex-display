# Persistencia

## SQLite

`data/bbqueue.sqlite` es la fuente de verdad de items, actividad y pertenencia a espacios. Debe guardar únicamente datos estructurados y referencias de assets.

No están permitidos:

- Data URI en `poster` o `backdrop`;
- imágenes Base64 dentro de `metadata_json`;
- blobs de imágenes en tablas del dominio.

## Assets

Los binarios viven en `data/assets/<origen>/`:

- `plex/`
- `playnite/`
- `manual/`
- `journals/`
- `uploads/`

Las imágenes raster compatibles se orientan, redimensionan sin ampliación y convierten a WebP. Los GIF y vídeos se conservan sin recomprimir.

## Saneamiento

BBQ no ejecuta conversiones ni saneamientos automáticos de assets antiguos durante el arranque. Las nuevas entradas deben pasar por la canalización de assets antes de persistirse: SQLite guarda rutas y metadatos, mientras que los binarios se almacenan bajo `data/assets`.
