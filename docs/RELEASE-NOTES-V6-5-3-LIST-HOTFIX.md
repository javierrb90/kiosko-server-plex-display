# v6.5.3 · List hotfix

Corrige un fallo de arranque cuando Colecciones se abría en modo Lista.

## Corregido

- `collections.js` ya no llama a `ratingFor` sin definir.
- El rating de Colecciones se obtiene desde `item.rating`.
- El CSV de Colecciones usa el mismo helper local de rating.
- Se corrige el toggle CSS `media-grid--list` en el render de Colecciones.
- Service Worker actualizado a `kiosko-v6-5-3`.
