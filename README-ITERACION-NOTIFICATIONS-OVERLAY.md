# Iteración v4 · Notification Center overlay

Cambios principales:

- El centro de notificaciones deja de ser una vista de pantalla completa y pasa a ser un overlay global.
- El overlay se abre desde el dock, desde el contador del Dashboard o al pulsar un toast.
- La vista activa permanece como fondo; no se usa blur real por compatibilidad con Wallpaper Engine.
- Se muestran sólo las últimas 8 notificaciones, sin paginación.
- Al abrir el overlay se marcan las notificaciones como leídas y se actualiza el contador del Dashboard.
- El dock incorpora iconos SVG inline, sin emojis ni fuentes externas.
- El dock es más grande y táctil.
- En modo privacidad no se muestra el dock, el overlay, los toasts ni el contador.

Notas:

- `Notifications` ya no se registra como vista del `ViewManager`.
- La persistencia en `notifications.json` se mantiene igual.
- La UI sólo muestra un resumen reciente; el histórico sigue disponible por API si se necesita.
