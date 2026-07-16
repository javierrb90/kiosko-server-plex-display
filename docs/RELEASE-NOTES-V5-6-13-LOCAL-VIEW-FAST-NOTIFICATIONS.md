# v5.6.13 · Vista local y notificaciones más rápidas

- La vista activa pasa a ser local por navegador/dispositivo.
- Los snapshots del WebSocket ya no cambian la vista activa ni aunque vengan de otra sesión.
- Se ignoran broadcasts `view:show` remotos salvo apertura de notificaciones.
- La última vista se guarda en `localStorage` por navegador.
- Eliminados logs ruidosos de WebSocket/snapshot en consola.
- El centro de notificaciones se abre visualmente antes de cargar/renderizar el histórico.
- Ajustes CSS para evitar estados activos fantasma en el dock móvil/Vivaldi.
