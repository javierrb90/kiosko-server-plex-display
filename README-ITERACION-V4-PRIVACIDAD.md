# Iteración v4 · Notificaciones pasivas, privacidad y admin externo

Cambios principales:

- Se consolida la diferencia entre notificaciones y eventos.
  - Notificaciones: Sonarr/Radarr y biblioteca añadida en Plex. Se guardan, generan toast y no navegan automáticamente.
  - Eventos: reproducción Plex y lanzamiento Playnite. Navegan a su vista, salvo si el modo privacidad está activo.
- Settings sale del dock principal. La configuración vive en `/admin.html`.
- Dock principal reducido a Dashboard, Notifications, Plex, Game y Collections.
- Dock más grande y táctil.
- Dashboard con contador de notificaciones no leídas.
- Al entrar en Notifications se marca todo como leído usando `state.lastNotificationsViewedAt`.
- Modo privacidad con candado en Dashboard:
  - bloquea auto-navegación;
  - oculta dock;
  - oculta contador y toasts;
  - deja sólo wallpapers + candado.
- Collections más limpia:
  - sólo nombre y botón `...`;
  - el resto de acciones pasan al menú;
  - permite masonry con aspect ratio original o cuadrícula cuadrada;
  - mantiene reordenación mediante botones en modo gestión.
- Admin añade simulador de eventos y notificaciones.
- Admin centraliza ajustes básicos: Plex, atenuación, dock, toasts, wallpapers, GIFs, CSS avanzado y subida manual.
- Plex/Game intentan extraer accent color de assets locales para aplicarlo a detalles visuales.

Notas:

- `/admin.html` está pensado para abrirse desde un navegador normal de la LAN, no desde Wallpaper Engine.
- La app principal se mantiene conservadora para evitar problemas de Wallpaper Engine.
