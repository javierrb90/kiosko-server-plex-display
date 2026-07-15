# Notas de versión estable

Esta versión consolida la evolución v4 y elimina restos de iteraciones antiguas.

## Cambios incluidos

- Base limpia con sólo tres vistas principales: Dashboard, Actual y Colecciones.
- Eliminadas vistas legacy no usadas: Plex individual, Game individual, Idle, Settings interna y Notifications como vista.
- Documentación principal actualizada.
- Conservada API REST de notificaciones externas con idempotencia.
- Reforzado el movimiento de wallpapers normales del Dashboard mediante animación controlada por JavaScript.
- Mantiene Docker/Portainer preparado para volumen externo `kiosko_volume`.

## Decisiones aplazadas

- Display skins físicos para VHS, CD, cartuchos, etc.
- Efecto CRT/shader visual.
