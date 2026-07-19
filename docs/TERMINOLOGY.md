# Terminología de producto y nombres técnicos

Desde **BBQ v7.3.0** la interfaz usa un vocabulario centrado en la finalidad del producto.

| Interfaz v7.3+ | Nombre técnico heredado | Significado |
|---|---|---|
| Actividad | `item` | Unidad que BBQ ayuda a recordar, priorizar, avanzar y terminar. |
| Actividades | workspace `database` | Vista completa de todas las actividades registradas. |
| Lista | `group`, rutas `collection-groups` | Organización manual, dinámica o mixta. |
| Cuadrícula | `grid` | Presentación mediante tarjetas. |
| Tabla | `list` | Presentación tabular. |
| Tarjeta completa | `standard` / antiguo «Normal» | Diseño con carátula y contenido lateral. |
| Terminado | `completed` | Actividad incluida en Colección. |
| Último movimiento | `lastActivityAt` | Último avance o actualización relevante. |

Los nombres técnicos se mantienen para no romper SQLite, backups, Playnite, Tautulli ni la API v1. No representan conceptos distintos. Las revisiones futuras deben interpretar `item` como Actividad, `group` como Lista y `database` como el espacio Actividades.

## Subtipo, Contexto y Detalle

Los tres campos se mantienen y son opcionales:

- **Subtipo** clasifica la actividad según el criterio del usuario o de una integración explícita. Participa en listas dinámicas y en el límite de On Deck.
- **Contexto** sitúa la actividad: plataforma, episodio, capítulo o unidad actual.
- **Detalle** resume el último evento o situación visible.

La interfaz compone `Contexto · Detalle · Subtipo`, omitiendo valores vacíos y duplicados.
