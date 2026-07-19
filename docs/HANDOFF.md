# Handoff técnico de BBQ

## Estado actual

BBQ 7.2.0 es una aplicación local Node.js + Express + WebSocket + SQLite. El directorio `/app/data` es la única persistencia operativa y contiene SQLite, settings, listas, diario y assets comprimidos.

## Objetivo

Ayudar al usuario a mantener una cola manejable de actividades y terminarlas. No es un sustituto de Plex ni Playnite y no debe duplicar sus catálogos completos.

## Modelo público

Campos nucleares: identidad, fuente, título, tipo, estados, actividad, valoración y assets.

Campos extra opcionales:

- `subtype`: clasificación manual;
- `context`: plataforma o unidad actual;
- `detail`: evento/estado legible.

Omitir conserva; `null`/vacío elimina; texto actualiza.

## Reglas importantes

- Backlog, On Deck y Colección son excluyentes en los flujos normales.
- On Deck limita a tres elementos por `subtype`; si falta, usa `type`.
- Los listas dinámicos deben usar el modelo común, especialmente subtipo y contexto.
- SQLite nunca almacena imágenes codificadas.
- Plex decide si algo es película o serie; Tautulli no debe imponer el tipo.
- El UUID interno no es contrato externo.

## Archivos clave

- `server.js`: HTTP, integraciones y flujos.
- `src/item-registry-store.js`: normalización y repositorio SQLite.
- `src/database/sqlite-database.js`: esquema y migraciones.
- `src/services/ingestion-contract.js`: contrato externo.
- `src/collection-group-store.js`: listas.
- `public/core/item-renderer.js`: Cuadrícula y Lista.
- `public/core/item-detail.js`: ficha y edición.
- `public/app.js`: shell, opciones y laboratorio debug.

## Comprobación

```bash
npm ci
npm run check
npm start
```


## Listas dinámicos (v7.2.1)

Las reglas dinámicas expuestas en la interfaz se basan únicamente en `subtype`. Los listas manuales se gestionan desde la ficha; los mixtos combinan ambas fuentes. El valor dinámico se compara con `contains` sin distinguir mayúsculas y minúsculas.


## Cambio de terminología en v7.3.0

Lee `TERMINOLOGY.md` antes de modificar rutas, modelos o textos. La interfaz dice Actividad/Lista, mientras que el código compatible conserva `item`/`group`.


## Notificaciones desde v7.3.1

Las notificaciones persistentes son efectos opcionales de eventos de integración, no el mecanismo de ingestión. `ingestExternalItem()` actualiza primero la Actividad; `maybePublishActivityNotification()` decide después si crea una entrada según `settings.notifications.events`.

Claves configurables: `plexAdded`, `plexPlayed`, `plexWatched` y `playniteStarted`. Las entradas guardan `meta.canonicalId` para abrir la ficha. El límite físico del almacén es 25.

El toast `#toast` solo representa `notification:new`. Los eventos `activity:received`, `current:update`, `plex:update` y `game:update` no deben volver a usarlo.

## Geometría de la ficha desde v7.3.1

En escritorio, `.item-detail__poster` permanece fijo y `.item-detail__info` es el único panel desplazable. `renderInfoSubview()` extrae `.item-detail-form__actions` y las monta en `.ui-modal__footer`; `renderBody()` limpia ese pie al volver al resumen. No vuelvas a insertar acciones persistentes dentro del contenido desplazable.
