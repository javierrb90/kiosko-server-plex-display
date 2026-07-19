# Historia y compatibilidad de nombres

BBQ nació como Kiosko Media Center y pasó por varias etapas antes de convertirse en un gestor local de actividades.

## Etapas

1. **Kiosko Media Center**: panel de notificaciones y webhooks de Plex/Playnite.
2. **BBQueue / Parrilla**: Backlog, On Deck, Colección y reglas temporales.
3. **BBQ 7.x**: SQLite, assets externos comprimidos, API de ingestión y backups.
4. **BBQ 7.3+**: vocabulario centrado en actividades y listas.

## Equivalencias que siguen apareciendo en el código

| Producto actual | Nombre técnico heredado |
|---|---|
| Actividad | item |
| Actividades | database workspace |
| Lista | group / collection-group |
| Tabla | list view |
| Cuadrícula | grid view |
| Tarjeta completa | standard card |
| Terminado | completed |
| Último movimiento | lastActivityAt |

No deben interpretarse como conceptos distintos. Los nombres internos se conservan para mantener compatibilidad con datos, rutas y scripts externos.
