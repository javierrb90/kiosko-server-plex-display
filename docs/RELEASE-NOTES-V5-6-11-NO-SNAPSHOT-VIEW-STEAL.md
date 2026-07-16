# v5.6.11 · Snapshots sin salto de vista

- Los `state:snapshot` actualizan datos, pero ya no cambian la vista activa después del arranque.
- La vista recordada se aplica sólo una vez, durante la carga inicial.
- Se reduce el riesgo de saltos en móvil por reconexiones WebSocket o snapshots retrasados.
- Los mensajes explícitos `view:show` se siguen respetando, pero se ignoran ecos recientes tras navegación local.
