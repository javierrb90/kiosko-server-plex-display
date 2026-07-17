# v6.9.1 · Manual Source Hotfix

## Corregido

- Los items creados en Kiosko ya pueden añadirse a Backlog sin tumbar el servidor.
- `BacklogStore` admite ahora buckets `kiosko` y `manual`, además de `plex` y `playnite`.
- Los payloads de Backlog y mapas internos contemplan todas las fuentes.
- `syncFromViews()` sincroniza todos los buckets de Backlog, no sólo Plex/Playnite.
- Los botones de seguir en Backlog / añadir a Deck vuelven a funcionar para items manuales.

## Motivo

v6.9 introdujo la fuente interna `kiosko`, pero el store legacy de Backlog sólo aceptaba `plex` y `playnite`, causando:

```text
Error: Fuente de backlog no soportada.
```

## Service worker

```text
kiosko-v6-9-1
```
