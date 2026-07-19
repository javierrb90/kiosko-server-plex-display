# Notificaciones

Las notificaciones son un historial persistente de eventos asociados a actividades.

## Fuentes configurables

Desde Opciones → Notificaciones se decide qué eventos generan una entrada:

- Plex: contenido añadido, reproducción iniciada y contenido visto.
- Playnite: juego iniciado.

Observar un evento, actualizar una actividad, mostrar un toast y crear una notificación son efectos independientes.

## Modelo visual

Cada notificación muestra:

- carátula;
- título;
- resumen `Contexto · Detalle · Subtipo`;
- momento de recepción;
- referencia canónica a la actividad.

El almacén conserva un máximo de 25 entradas y descarta las más antiguas.

## Lectura

Abrir el panel marca las notificaciones como leídas y oculta el toast. Pulsar o cerrar el toast también lo marca como leído. El contador de la campana representa entradas posteriores a `lastNotificationsViewedAt`.

## Navegación

Al abrir una notificación, BBQ consulta la actividad actual y navega a:

1. Colección si está terminada.
2. On Deck si está activa allí.
3. Backlog si pertenece al Backlog.
4. Actividades si no pertenece a ningún espacio.

Las acciones posteriores reutilizan los flujos normales de movimiento y feedback visual.
