# Integraciones

## Plex / Tautulli

Recibe eventos de biblioteca y reproducción. Las series se consolidan por identidad de serie y actualizan el detalle con episodio y acción.

Las opciones deben definir por evento:

- observar o ignorar;
- crear si no existe;
- actualizar metadata;
- actualizar actividad;
- quitar la marca manual Achicharrado.

## Playnite

El script `playnite-before-game-start.ps1` envía el inicio de un juego. Por defecto, el inicio actualiza actividad y puede retirar Achicharrado.

## Sonarr / Radarr

Existe adaptador ARR y webhook. Su uso actual está orientado principalmente a notificaciones y debe revisarse durante la normalización de integraciones.

## Principio de diseño

Cada integración traduce su payload a eventos de dominio. Los stores no deberían conocer formatos de Plex, Playnite o ARR. Esa separación será importante al extraer servicios desde `server.js`.

## Arquitectura de integración

Toda integración debe separar tres responsabilidades:

1. **Adaptador**: traduce el payload del proveedor al contrato genérico de ingestión.
2. **Ingestión**: crea o actualiza el ítem, registra actividad y sincroniza Backlog/On Deck.
3. **Aviso opcional**: crea una notificación visible únicamente cuando el usuario la haya activado.

Tautulli y Playnite ya usan la API interna de ingestión. Una integración futura debe reutilizar `POST /api/v1/items/upsert` o llamar al mismo servicio, en vez de modificar stores concretos.

### Identidad

Las series de Plex deben compartir un `canonicalId` de serie. El detalle conserva el episodio y la acción más reciente; mover la serie a Backlog, On Deck o Colección no debe sustituirlo por el texto genérico «Serie».
