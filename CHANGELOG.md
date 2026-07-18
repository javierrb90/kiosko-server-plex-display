# Changelog

## 6.15.0

- Backups separados y versionados para biblioteca y configuración.
- Exportación e importación de assets con verificación SHA-256.
- Modos reemplazar y fusionar para la biblioteca.
- Exportación opcional de credenciales.
- Acciones seguras para borrar biblioteca, restablecer configuración o reiniciar todo.
- Documentación del contrato que permitirá migrar a SQLite sin acoplar los backups al almacenamiento.

## 6.14.4

- La API de ingestión persiste el contenido actual para reproducciones de Playnite y Plex.
- Al recargar ya no reaparece el contenido anterior.
- La respuesta de `/api/v1/events` incluye `currentContent` cuando el evento representa actividad actual.


## 6.14.2 — Toasts de actividad para la API v1

- `behavior.showToast` emite un evento visual independiente.
- Playnite vuelve a mostrar el toast al iniciar un juego.
- El toast permite abrir el ítem asociado.

## 6.14.1 — API de ingestión y consistencia de Plex

- API externa versionada para crear y actualizar ítems.
- Tautulli y Playnite reutilizan el flujo genérico de ingestión.
- Corrección del detalle de series al pasar por Backlog, On Deck y Colección.
- Estado activo de Base de datos y miniaturas en la vista Lista.

## 6.14.0 — saneamiento previo a SQLite

- Eliminada documentación histórica y notas de versiones dispersas.
- Documentación técnica reescrita desde el código actual.
- Eliminado `public/core/item-list-helpers.js`, que no estaba importado.
- Unificadas las dos rutas duplicadas `GET /api/health`.
- Actualizados nombre, versión, manifest y caché del service worker a BBQueue.
- Añadido `npm run check` para validar sintaxis, rutas duplicadas y estructura documental.
- Documentado el inventario de deuda técnica y el plan de migración a SQLite.

La historia previa se conserva en el control de versiones o en los ZIP publicados, no dentro del paquete de trabajo actual.
