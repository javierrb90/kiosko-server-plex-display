# Arquitectura

## Resumen

BBQueue es una aplicación Node.js sin framework de frontend.

```text
Navegador
  ├─ public/app.js
  ├─ public/views/*
  └─ public/core/*
        │ HTTP + WebSocket
Servidor Express (server.js)
  ├─ adapters/*
  ├─ services/*
  ├─ stores JSON
  └─ assets locales
```

## Backend

`server.js` contiene actualmente configuración, middleware, rutas, webhooks, composición de estados y arranque. Los almacenes de `src/` encapsulan lectura y escritura de JSON, aunque parte de la lógica de dominio permanece en el servidor.

Componentes principales:

- `item-registry-store.js`: registro canónico y consulta global.
- `backlog-store.js`: Backlog y compatibilidad con finalizaciones históricas.
- `on-deck-store.js`: On Deck.
- `journal-store.js`: diario y reviews.
- `collection-group-store.js`: grupos.
- `settings-store.js`: configuración normalizada.
- `event-store.js`: notificaciones.
- `state-store.js`: estado efímero persistido.
- `realtime-hub.js`: difusión WebSocket.
- `asset-service.js`: descarga y caché de imágenes.

## Frontend

- `app.js`: arranque, estado global, navegación, opciones y coordinación.
- `view-manager.js`: ciclo de vida de vistas.
- `item-segment-view.js`: implementación compartida de Base de datos, Backlog, On Deck y Colección.
- `item-detail.js`: ficha, edición, diario y valoración.
- `item-renderer.js`: tarjetas y filas.
- `item-utils.js`: normalización visual y utilidades.

## Límite actual

El registro canónico convive con almacenes históricos separados. Esta duplicación es la principal razón para migrar a SQLite y establecer una única fuente de verdad transaccional.

## Capa de ingestión

`src/services/ingestion-contract.js` define y valida el contrato externo v1. `server.js` aplica ese contrato mediante una única operación de dominio que actualiza el registro canónico, las membresías manuales y los eventos en tiempo real. Esta capa es el punto de extensión recomendado antes de la migración a SQLite.
