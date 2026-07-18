# BBQ

BBQ es una aplicación local para organizar una biblioteca personal mediante cuatro vistas fijas: **Base de datos**, **Backlog**, **On Deck** y **Colección**. La parrilla utiliza la actividad de cada item para señalar qué necesita atención.

## Persistencia

Todo el estado persistente debe montarse en un único volumen `data`:

```text
data/
├── bbqueue.sqlite       # items, actividad y pertenencia a espacios
├── assets/              # carátulas, fondos e imágenes adjuntas comprimidas
├── backups/
└── *.json               # configuración y estados auxiliares
```

SQLite nunca debe contener imágenes Base64. Las columnas de imagen guardan rutas `/assets/...` o, cuando procede, una URL externa. Toda imagen recibida por Plex, Playnite, la API o una carga manual se normaliza, redimensiona y convierte a WebP antes de escribirse en `data/assets`.

## Instalación

```bash
npm ci
npm start
```

Node.js 22 o posterior. La configuración opcional se realiza mediante `.env`; consulta `.env.example`.

## Integraciones

- **Playnite:** `POST /api/v1/events`
- **Tautulli/Plex:** `POST /webhook/tautulli`
- **API genérica:** `POST /api/v1/items/upsert` y `POST /api/v1/events`
- Esquema de ingestión: `GET /api/v1/ingestion/schema`

Las integraciones comparten la misma canalización de ingestión, actividad, assets y eventos WebSocket.

## Feedback visual

- **Dar la vuelta:** giro de la tarjeta real antes de enviar la actualización.
- **Actividad desde la ficha:** giro corto tras cerrar la ficha.
- **Mover entre espacios:** navegación, limpieza de filtros, visibilidad del tipo y animación de colocación.
- **Lista:** iluminación temporal de la fila.

## Comprobaciones

```bash
npm run check
```

Valida sintaxis, rutas duplicadas y estructura básica del proyecto.

## Documentación

- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/PERSISTENCE.md`
- `docs/BACKUPS.md`
- `CHANGELOG.md`
- `RELEASE-v7.0.18.md`
