# Arquitectura técnica

## Visión general

BBQ es una aplicación Node.js con Express, WebSocket, frontend SPA sin framework y SQLite. `server.js` compone los servicios y mantiene compatibilidad con rutas heredadas.

```text
Integraciones / navegador
          │
          ▼
Express + adaptadores
          │
          ▼
Contrato de ingestión / servicios
          │
          ├── SQLite: ítems, actividad y estados
          ├── JSON: configuración y almacenes auxiliares
          └── data/assets: binarios normalizados
          │
          ▼
WebSocket → frontend SPA
```

## Backend

- `server.js`: rutas, autenticación, webhooks, coordinación y broadcasts.
- `src/item-registry-store.js`: repositorio principal y persistencia SQLite.
- `src/database/sqlite-database.js`: conexión, transacciones y migraciones de esquema.
- `src/services/ingestion-contract.js`: normalización de la API externa.
- `src/asset-service.js`: descarga, validación, redimensionado y compresión.
- `src/adapters/tautulli.js`: traduce eventos de Tautulli/Plex.
- `src/adapters/playnite.js`: compatibilidad con el webhook antiguo de Playnite.
- `src/adapters/arr.js`: ingestión de eventos ARR.
- `src/realtime-hub.js`: conexiones WebSocket y broadcast.
- `src/settings-store.js`: configuración global.
- `src/journal-store.js`: diario y reseñas.
- `src/backup-service.js`: exportación, importación y reset.

## Frontend

- `public/app.js`: arranque, navegación global, socket y opciones.
- `public/views/item-segment-view.js`: implementación compartida de los cuatro espacios.
- `public/core/item-renderer.js`: tarjetas, filas y chips.
- `public/core/item-detail.js`: ficha y acciones.
- `public/core/item-utils.js`: identidad visual, tipos, estados y formato.
- `public/style.css`: sistema visual acumulado. Debe evitarse seguir añadiendo overrides históricos sin limpiar reglas anteriores.

## Flujo de actualización

1. Una acción HTTP modifica el repositorio.
2. El servidor devuelve el ítem actualizado.
3. El servidor emite un evento WebSocket.
4. El frontend fusiona el ítem por `canonicalId`.
5. Se renderiza la vista y se aplica feedback visual.

Las acciones locales que necesitan una animación exacta pueden animar el nodo real antes de enviar la petición, como Dar la vuelta.

## Decisiones relevantes

- Los espacios son fijos en UI, pero sus reglas deben seguir declaradas de forma fácil de modificar en código.
- La API pública no debe depender del esquema de SQLite.
- Los IDs externos no son claves primarias internas.
- Los assets se externalizan antes de persistir.
- Plex y Playnite deben converger en el mismo contrato de ingestión.
