# API y tiempo real

## Familias de endpoints

- Sistema: `/api/health`, `/api/diagnostics`, `/api/snapshot`, `/api/state`.
- Configuración: `/api/settings`, CSS personalizado, exportación.
- Biblioteca: `/api/items` y subrecursos.
- Espacios: rutas canónicas de Backlog, Deck y Colección, más rutas heredadas.
- Diario y review: `/api/items/:canonicalId/journal`, `/activity`, `/review`.
- Grupos: `/api/collection-groups`.
- Integraciones: `/webhook/tautulli`, `/webhook/playnite`, `/webhook/arr`.
- Compatibilidad: `/webhook`, `/api/backlog/:source/:id`, `/api/on-deck/:id`, `/api/completions`.

## Contrato recomendado

La API canónica es la basada en `/api/items/:canonicalId/...`. Las rutas antiguas deben considerarse adaptadores de compatibilidad y retirarse después de migrar el frontend y los scripts externos.

## WebSocket

El servidor emite deltas mediante `RealtimeHub`. El frontend combina los eventos con su estado local. Para nuevas funciones:

- usar nombres de evento centrados en dominio;
- incluir el ítem canónico actualizado;
- evitar obligar a recargar snapshots completos;
- documentar qué vistas deben reaccionar.

## Problema actual

La forma de los payloads no está formalizada mediante esquema. Antes de ampliar la API conviene añadir validación de entrada y contratos versionados.

## API externa de ingestión v1

Las integraciones nuevas no deben escribir directamente en archivos JSON ni crear notificaciones para representar actividad de biblioteca. Deben usar la API de ingestión versionada.

### Rutas

- `POST /api/v1/items/upsert`: crea o actualiza una entidad externa.
- `POST /api/v1/events`: alias orientado a eventos; usa el mismo contrato.
- `GET /api/v1/ingestion/schema`: devuelve un ejemplo de payload.

Si `BBQUEUE_API_TOKEN` está configurado, las rutas de escritura requieren `Authorization: Bearer <token>` o `X-API-Key: <token>`.

### Contrato

```json
{
  "source": "example",
  "externalId": "item-123",
  "canonicalId": "example:item-123",
  "entityType": "series",
  "title": "Serie de ejemplo",
  "detail": "S01E03 · reproducido",
  "eventType": "played",
  "occurredAt": "2026-07-18T12:00:00.000Z",
  "assets": {
    "poster": "https://example.test/poster.jpg",
    "backdrop": "https://example.test/backdrop.jpg"
  },
  "metadata": {
    "provider": "example"
  },
  "behavior": {
    "createIfMissing": true,
    "updateMetadata": true,
    "updateDetail": true,
    "updateActivity": true,
    "clearCharred": true
  }
}
```

### Reglas

- `source`, `title` y uno entre `canonicalId` o `externalId` son obligatorios.
- `canonicalId` debe ser estable para evitar duplicados.
- `occurredAt` debe incluir fecha y hora.
- `behavior` decide por evento si se crea, se actualiza la actividad, se reemplaza el detalle, se elimina Achicharrado o se muestra un toast.
- `showToast: true` emite `activity:received` por WebSocket; no crea una notificación persistente.
- Si el ítem pertenece a Backlog u On Deck, sus representaciones de seguimiento se actualizan con el mismo detalle y timestamp.
- La respuesta devuelve el ítem canónico final y si fue creado o actualizado.

Tautulli y Playnite son adaptadores del mismo contrato. El centro de notificaciones queda reservado para avisos visibles, no para persistir actividad de ítems.

### Toasts de actividad

Cuando `behavior.showToast` es `true`, el servidor emite `activity:received` con `source`, `eventType`, título, detalle, assets e identificador canónico. El frontend muestra el toast grande existente y permite abrir el ítem al pulsarlo. Este evento es independiente del centro de notificaciones.
