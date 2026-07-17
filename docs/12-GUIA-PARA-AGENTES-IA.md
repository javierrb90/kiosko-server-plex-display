# 12 · Guía para agentes IA

Este documento resume cómo debe razonar un agente IA o desarrollador al modificar Kiosko Media Center.

## Base estable

La base estable actual es:

```text
Kiosko Media Center v6.0
```

Deriva de v5.9.22.

No volver a versiones anteriores salvo para comparar comportamiento.

## Antes de tocar código

1. Entender qué vista está afectada.
2. Identificar si el problema es:
   - frontend;
   - backend;
   - persistencia;
   - WebSocket;
   - integración externa;
   - canonicalización.
3. Revisar logs.
4. Consultar `/api/diagnostics`.
5. Evitar soluciones globales si basta con evento delta.

## Comandos de validación

Ejecutar como mínimo:

```bash
node --check server.js
node --check src/realtime-hub.js
node --check src/backlog-store.js
node --check src/on-deck-store.js
node --check src/state-store.js
node --check src/settings-store.js
node --check src/event-store.js
node --check src/collection-group-store.js
node --check src/services/plex-service.js
node --check src/adapters/tautulli.js
node --check public/app.js
node --check public/core/item-detail.js
node --check public/views/backlog.js
node --check public/views/on-deck.js
node --check public/views/current-content.js
node --check public/views/collections.js
```

Además hacer prueba real ESM de módulos críticos:

```bash
node --input-type=module -e "
import { canonicalKeyForItem, BacklogStore, CompletionStore } from './src/backlog-store.js';
import { OnDeckStore } from './src/on-deck-store.js';
import { RealtimeHub } from './src/realtime-hub.js';
console.log('module-import-ok');
"
```

`node --check` no detecta exports faltantes entre módulos. La prueba ESM sí.

## Reglas importantes

### No reintroducir broadcasts globales para acciones de item

Preferir eventos delta:

```text
item:moved-to-deck
item:moved-to-backlog
item:completed
item:backlog-upserted
```

### No convertir Backlog en biblioteca completa

Backlog es bandeja de novedades.

### No llenar On Deck de episodios

On Deck debe seguir a la serie cuando el item es episodio/temporada.

### Sí permitir episodios nuevos en Backlog

Aunque la serie esté en On Deck.

### No eliminar aviso “Serie en On Deck”

Ese aviso es parte del comportamiento v6.0.

### No sincronizar vista activa entre dispositivos

La vista es local por navegador/dispositivo.

### No añadir backups automáticos

El usuario lo descartó explícitamente para esta fase.

### No añadir vista Continuar

También descartado.

### No añadir modo salón/sync

También descartado.

## Mapa de cambios frecuentes

### Problema en Backlog

Mirar:

```text
public/views/backlog.js
src/backlog-store.js
server.js
```

### Problema en On Deck

Mirar:

```text
public/views/on-deck.js
src/on-deck-store.js
server.js
```

### Problema en Colecciones

Mirar:

```text
public/views/collections.js
src/backlog-store.js CompletionStore
```

### Problema en ficha/modal

Mirar:

```text
public/core/item-detail.js
```

### Problema Tautulli/Plex

Mirar:

```text
src/adapters/tautulli.js
src/services/plex-service.js
server.js handleTautulliWebhook
```

### Problema de grupos

Mirar:

```text
src/collection-group-store.js
public/core/item-detail.js
public/views/backlog.js
public/views/on-deck.js
public/views/collections.js
```

### Problema de rendimiento

Mirar:

```text
/api/diagnostics
server.js trace helpers
src/*-store.js persist
src/realtime-hub.js
public/app.js delta handlers
```

## Flujo Tautulli created

Comportamiento esperado:

```text
event=created
type=episode
→ isLibraryAdded=true
→ normalizePlexCreatedBacklogItem()
→ backlogStore.upsert("plex", item)
→ broadcastDelta("item:backlog-upserted")
→ frontend upsertBacklogState()
→ Backlog renderiza tarjeta
→ si serie está en On Deck, muestra "Serie en On Deck"
```

## Service Worker

Siempre que se entregue una versión nueva:

```text
public/service-worker.js
```

Actualizar cache:

```text
kiosko-vX-Y-Z
```

Para v6.0:

```text
kiosko-v6-0
```

## Estilo de cambios

Preferir cambios pequeños, verificables y con release notes.

Cada versión debería incluir:

- resumen;
- archivos afectados;
- validación;
- si cambia datos, explicar migración;
- si cambia WebSocket, explicar evento.

## No ocultar incertidumbre

Si una hipótesis no está confirmada, decirlo.

Usar logs y diagnósticos antes de parchear a ciegas.
