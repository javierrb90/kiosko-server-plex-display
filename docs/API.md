# API externa

## Ingestión

`POST /api/v1/events` y `POST /api/v1/items/upsert` comparten contrato.

Las imágenes pueden enviarse como URL HTTP(S), Data URI o ruta `/assets/...`. Antes de persistir el item, BBQ las guarda en `data/assets/<source>/` y sustituye el valor por una ruta local. La metadata se limpia de cualquier Data URI.

Consulta el contrato actual en `GET /api/v1/ingestion/schema`.

## Autenticación

Configura `BBQUEUE_API_TOKEN` y envía `Authorization: Bearer <token>` o `X-API-Key`.
