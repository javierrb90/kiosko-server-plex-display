# Arquitectura

## Capas

- `server.js`: composición HTTP, webhooks, WebSocket y coordinación.
- `src/item-registry-store.js`: repositorio principal de items sobre SQLite.
- `src/asset-service.js`: almacenamiento, redimensionado y compresión de imágenes.
- `src/services/ingestion-contract.js`: contrato estable para integraciones externas.
- `public/views/item-segment-view.js`: vistas, filtros y feedback visual de los espacios.
- `public/core/item-detail.js`: ficha y acciones sobre un item.

## Principios

1. La API no depende del formato visual del frontend.
2. SQLite guarda datos; el sistema de archivos guarda binarios.
3. Las integraciones pasan por un contrato común de ingestión.
4. Las animaciones de confirmación actúan sobre el nodo definitivo, nunca sobre clones flotantes.
5. Los espacios son fijos; su presentación y tipos visibles son configurables.
