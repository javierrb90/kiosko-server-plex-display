# Checklist de pruebas manuales

## Arranque

- `npm start` arranca sin errores.
- `/api/health` devuelve `ok: true`.
- `/admin.html` carga correctamente.
- El Dashboard aparece como vista inicial.

## Dashboard

- Carga wallpapers normales.
- Los wallpapers normales tienen movimiento sutil si la opción está activa.
- Los vídeos se reproducen como fondo.
- El botón mute aparece sólo en fondos de vídeo con audio permitido.
- La barra de progreso avanza de forma fluida.
- Swipe izquierda/derecha cambia de fondo.
- Las colecciones seleccionadas aparecen como fuente del Dashboard.

## Actual

- Webhook Plex actualiza la vista Actual.
- Webhook Playnite actualiza la vista Actual.
- El botón de limpiar contenido actual deja la vista vacía.
- El layout no solapa carátula y texto.

## Notificaciones

- `POST /api/notify` crea notificación.
- El toast aparece con el tamaño configurado.
- El overlay muestra hasta 50 notificaciones.
- El botón limpiar elimina todas las notificaciones.
- `externalId` evita duplicados.

## Colecciones

- Crear colección.
- Añadir item con portada.
- Añadir item con portada + backdrop.
- Añadir item con vídeo.
- Editar título, portada, backdrop y vídeo.
- Reordenar items.
- Eliminar item.
- Usar colección como fuente del Dashboard.

## Persistencia

- Reiniciar contenedor.
- Confirmar que se conservan settings, wallpapers, colecciones y notificaciones.
