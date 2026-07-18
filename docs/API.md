# API HTTP y tiempo real

## Convenciones

- JSON UTF-8.
- Los identificadores en ruta deben enviarse con `encodeURIComponent`.
- Las respuestas de error usan normalmente `{ "error": "mensaje" }`.
- La API externa versionada puede protegerse con `BBQUEUE_API_TOKEN` mediante `Authorization: Bearer` o `X-API-Key`.

## Diagnóstico y estado

- `GET /api/health`: versión, estado y recuentos.
- `GET /api/diagnostics`: diagnóstico ampliado.
- `GET /api/snapshot`: snapshot inicial para el frontend.
- `GET /api/settings` / `PUT /api/settings`: configuración pública.

## Biblioteca

- `GET /api/items`: lista y filtros.
- `POST /api/items`: creación manual.
- `GET /api/items/:canonicalId`: ficha actual.
- `PATCH /api/items/:canonicalId`: actualización parcial.
- `DELETE /api/items/:canonicalId`: eliminación definitiva.
- `POST /api/items/:canonicalId/backlog`: añadir a Backlog.
- `DELETE /api/items/:canonicalId/backlog`: retirar de Backlog.
- `POST /api/items/:canonicalId/deck`: mover o añadir a On Deck.
- `DELETE /api/items/:canonicalId/deck`: retirar de On Deck.
- `POST /api/items/:canonicalId/complete`: marcar como terminado y pasar a Colección.
- `DELETE /api/items/:canonicalId/collection`: retirar de Colección.
- `POST /api/items/:canonicalId/activity`: registrar actividad o Dar la vuelta.
- `PUT /api/items/:canonicalId/assessment`: rating y evaluación.

## Diario y reseña

- `GET /api/items/:canonicalId/journal`
- `POST /api/items/:canonicalId/activity`
- `PATCH /api/items/:canonicalId/journal/:entryId`
- `DELETE /api/items/:canonicalId/journal/:entryId`
- `PUT /api/items/:canonicalId/review`
- `DELETE /api/items/:canonicalId/review`

## Grupos

- `GET /api/collection-groups`
- `POST /api/collection-groups`
- `PATCH /api/collection-groups/:id`
- `DELETE /api/collection-groups/:id`
- `POST /api/collection-groups/:id/items`
- `DELETE /api/collection-groups/:id/items/:itemId`

El nombre histórico de la ruta conserva `collection-groups`, pero el concepto de producto es **Grupo**.

## Parrilla

- `GET /api/grill/pending`
- `POST /api/items/:canonicalId/grill/turn`
- `POST /api/items/:canonicalId/grill/char`
- `DELETE /api/items/:canonicalId/grill/char`

## API externa v1

### Esquema

`GET /api/v1/ingestion/schema`

### Upsert genérico

`POST /api/v1/items/upsert`

Crea o actualiza una entidad sin necesidad de representar un evento de actividad.

### Evento genérico

`POST /api/v1/events`

Ejemplo:

```json
{
  "source": "playnite",
  "externalId": "uuid-del-juego",
  "canonicalId": "playnite:uuid-del-juego",
  "entityType": "games",
  "title": "Nombre del juego",
  "detail": "PC (Windows)",
  "eventType": "started",
  "occurredAt": "2026-07-18T18:30:00.000Z",
  "assets": {
    "poster": "data:image/jpeg;base64,...",
    "backdrop": "data:image/jpeg;base64,..."
  },
  "metadata": {},
  "behavior": {
    "createIfMissing": true,
    "updateMetadata": true,
    "updateDetail": true,
    "updateActivity": true,
    "clearCharred": true,
    "showToast": true
  }
}
```

Las imágenes se externalizan antes de guardar. `showToast` solicita feedback visual, no una notificación persistente.

## Webhooks

- `POST /webhook/tautulli` y compatibilidad `POST /webhook`
- `POST /webhook/playnite` para scripts antiguos
- `POST /webhook/arr/:source`

## Backups y reset

- `GET /api/backups/library`
- `GET /api/backups/settings`
- `POST /api/backups/library/import`
- `POST /api/backups/settings/import`
- `POST /api/reset/library`
- `POST /api/reset/settings`
- `POST /api/reset/all`

## WebSocket

El frontend recibe snapshots y deltas. Eventos relevantes incluyen actualizaciones de ítems, diario, actividad y `activity:received` para toast de actividad. No deben usarse las notificaciones persistentes como transporte genérico de integraciones.
