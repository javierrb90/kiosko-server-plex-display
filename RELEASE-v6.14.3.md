# BBQueue v6.14.3

## Corrección

- Los eventos de ingestión con `behavior.showToast: true` ya no dependen de la preferencia de toasts del centro de notificaciones.
- El evento `playnite/started` vuelve a actualizar el indicador visual de contenido actual.
- La actividad sigue sin crear notificaciones persistentes.

## Causa

La v6.14.2 emitía correctamente `activity:received`, pero el frontend cancelaba el toast cuando `settings.notifications.toastEnabled` estaba desactivado. La API solicitaba el toast explícitamente, pero esa intención se perdía en la capa de interfaz.
