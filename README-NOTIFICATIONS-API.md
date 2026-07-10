# Kiosko Media Center · API REST de notificaciones externas

Esta API permite que servicios externos creen notificaciones persistentes en Kiosko Media Center.
Está pensada para integraciones locales como Syncthing, scripts PowerShell, cron jobs u otras herramientas de automatización.

Los dos endpoints son equivalentes y comparten exactamente la misma lógica:

```http
POST /api/notifications
POST /api/notify
```

El cuerpo debe enviarse como JSON.

## Payload básico

```json
{
  "source": "syncthing",
  "type": "sync_completed",
  "priority": "normal",
  "title": "Capturas de pantalla",
  "subtitle": "Synchronization received"
}
```

Campos admitidos:

| Campo | Tipo | Descripción |
|---|---|---|
| `source` | string | Origen de la notificación. Ejemplo: `syncthing`, `system`, `script`. |
| `type` | string | Tipo de evento externo. Ejemplo: `sync_completed`, `sync_error`. |
| `priority` | string | `low`, `normal` o `high`. Si no se envía, usa `normal`. |
| `title` | string | Título principal. |
| `subtitle` | string | Texto secundario. |
| `message` | string | Alias útil para texto principal/secundario. |
| `detail` | string | Alias para texto secundario. |
| `description` | string | Alias para texto secundario. |
| `summary` | string | Alias para título. |
| `image` | string | URL, ruta local o Data URI de una imagen opcional. |
| `backdrop` | string | URL, ruta local o Data URI de un fondo opcional. |
| `url` | string | URL opcional asociada a la notificación. |
| `meta` | object | Datos técnicos adicionales. |
| `externalId` | string | Identificador externo opcional para idempotencia. |

## Idempotencia con `externalId`

`externalId` permite evitar duplicados cuando un servicio reintenta la misma petición.

Si se recibe una notificación con un `externalId` nuevo:

- se crea la notificación;
- se guarda en `data/notifications.json`;
- se registra la clave en `data/notification-idempotency.json`;
- se emite el toast al frontend;
- se devuelve `201 Created`.

Si se recibe otra petición con el mismo `externalId`:

- no se crea otra notificación;
- no se actualiza la fecha original;
- no se emite otro toast;
- se devuelve `200 OK` con `duplicate: true`.

`externalId` es opcional. Si no se envía, cada petición crea una notificación nueva.

También puede enviarse mediante la cabecera HTTP `Idempotency-Key`. Si existen ambos valores, tiene prioridad `externalId` en el JSON.

## Validación de `externalId`

Cuando se envía, debe cumplir:

- ser un string;
- no estar vacío;
- tener como máximo 255 caracteres.

Si no cumple, la API devuelve `400 Bad Request`.

## Ejemplo Syncthing

```json
{
  "source": "syncthing",
  "type": "sync_completed",
  "priority": "normal",
  "title": "Capturas de pantalla",
  "subtitle": "Synchronization received",
  "externalId": "syncthing:ABC123:screenshots:received:184563",
  "meta": {
    "folderId": "screenshots",
    "folderName": "Capturas de pantalla",
    "instanceId": "ABC123",
    "instanceName": "MiniPC",
    "direction": "received",
    "timestamp": "2026-07-10T21:13:42+02:00",
    "count": 3,
    "files": [
      "Screenshots/Pantalla 1.png"
    ]
  }
}
```

## cURL

Crear una notificación idempotente:

```bash
curl -X POST http://localhost:3000/api/notify \
  -H "Content-Type: application/json" \
  -d '{
    "source":"syncthing",
    "type":"sync_completed",
    "priority":"normal",
    "title":"Capturas de pantalla",
    "subtitle":"Synchronization received",
    "externalId":"syncthing:ABC123:screenshots:received:184563",
    "meta":{"folderId":"screenshots","count":3}
  }'
```

Primera respuesta esperada:

```json
{
  "ok": true,
  "duplicate": false,
  "notification": {
    "id": "...",
    "externalId": "syncthing:ABC123:screenshots:received:184563",
    "source": "syncthing",
    "type": "sync_completed",
    "priority": "normal",
    "title": "Capturas de pantalla",
    "subtitle": "Synchronization received",
    "createdAt": "...",
    "meta": {
      "folderId": "screenshots",
      "count": 3,
      "externalId": "syncthing:ABC123:screenshots:received:184563"
    }
  }
}
```

Repetir exactamente la misma petición devuelve:

```json
{
  "ok": true,
  "duplicate": true,
  "notification": {
    "id": "..."
  }
}
```

Si la notificación original ya salió del histórico de las últimas 50, la respuesta puede ser:

```json
{
  "ok": true,
  "duplicate": true,
  "notification": null
}
```

## PowerShell

```powershell
$payload = @{
  source = "syncthing"
  type = "sync_completed"
  priority = "normal"
  title = "Capturas de pantalla"
  subtitle = "Synchronization received"
  externalId = "syncthing:ABC123:screenshots:received:184563"
  meta = @{
    folderId = "screenshots"
    count = 3
  }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Uri "http://localhost:3000/api/notify" `
  -Method POST `
  -ContentType "application/json" `
  -Body $payload
```

## Códigos HTTP

| Código | Significado |
|---|---|
| `201` | Notificación creada. |
| `200` | `externalId` ya procesado. No se creó duplicado. |
| `400` | Payload incorrecto, normalmente `externalId` inválido. |
| `500` | Error interno o de persistencia. |

## Persistencia

- Notificaciones: `data/notifications.json`.
- Claves idempotentes recientes: `data/notification-idempotency.json`.
- El sistema conserva un máximo de 50 notificaciones.
- Las claves de idempotencia se conservan durante 7 días.
- La limpieza se ejecuta al iniciar y antes de guardar nuevas claves.
- Las escrituras JSON se hacen mediante archivo temporal y renombrado.
