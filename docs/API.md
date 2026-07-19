# API HTTP y tiempo real

## Contrato común de actividad

La API externa usa un modelo deliberadamente pequeño:

```json
{
  "source": "playnite",
  "externalId": "uuid-del-juego",
  "canonicalId": "playnite:uuid-del-juego",
  "entityType": "games",
  "title": "Hades",
  "subtype": "roguelike",
  "context": "PC",
  "detail": "Iniciado",
  "eventType": "started",
  "occurredAt": "2026-07-19T10:00:00.000Z",
  "assets": {
    "poster": "data:image/jpeg;base64,...",
    "backdrop": "data:image/jpeg;base64,..."
  },
  "behavior": {
    "createIfMissing": true,
    "updateDetail": true,
    "updateActivity": true,
    "clearCharred": true,
    "showToast": true
  }
}
```

`subtype`, `context` y `detail` son opcionales:

- omitido: conserva el valor;
- `null` o `""`: lo elimina;
- texto: lo actualiza.

`subtype` se considera manual por defecto. Una integración solo debe enviarlo cuando quiera cambiarlo conscientemente.

## Rutas principales

### Estado

- `GET /api/health`
- `GET /api/diagnostics`
- `GET /api/snapshot`
- `GET /api/settings`
- `PUT /api/settings`

### Biblioteca

- `GET /api/items`
- `POST /api/items`
- `GET /api/items/:canonicalId`
- `PATCH /api/items/:canonicalId`
- `PATCH /api/items/:canonicalId/dates` — también admite `subtype`, `context` y `subtitle`.
- `DELETE /api/items/:canonicalId`
- `POST|DELETE /api/items/:canonicalId/backlog`
- `POST|DELETE /api/items/:canonicalId/deck`
- `POST /api/items/:canonicalId/complete`
- `DELETE /api/items/:canonicalId/collection`
- `POST /api/items/:canonicalId/activity`

### Listas

- `GET /api/collection-groups`
- `POST /api/collection-groups`
- `PATCH /api/collection-groups/:id`
- `DELETE /api/collection-groups/:id`
- `POST /api/collection-groups/:id/items`
- `DELETE /api/collection-groups/:id/items/:itemId`

La ruta conserva el nombre histórico `collection-groups`; el concepto de producto es Lista.

### API externa v1

- `GET /api/v1/ingestion/schema`
- `POST /api/v1/items/upsert`
- `POST /api/v1/events`

Puede protegerse con `BBQUEUE_API_TOKEN` mediante `Authorization: Bearer` o `X-API-Key`.

### Webhooks

- `POST /webhook/tautulli` y compatibilidad `POST /webhook`
- `POST /webhook/playnite`
- `POST /webhook/arr/:source`

### Debug

- `POST /api/simulate/notification`
- `POST /api/simulate/plex`
- `POST /api/simulate/playnite`
- `GET|DELETE /api/debug/history`

## Assets

Todas las imágenes entrantes se externalizan, redimensionan y comprimen antes de persistir. SQLite almacena rutas, nunca Data URI o blobs de imagen.
