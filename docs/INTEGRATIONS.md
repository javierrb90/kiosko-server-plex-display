# Integraciones

## Patrón común

Cada integración debe traducir su formato al contrato genérico de ingestión. La ingestión puede producir efectos independientes:

- crear si falta;
- actualizar metadata;
- actualizar actividad;
- quitar Achicharrado;
- mostrar toast;
- persistir una notificación, solo cuando tenga sentido explícito.

## Playnite

La integración recomendada usa `POST /api/v1/events` desde el script Before Game Starts.

Identidad:

```text
canonicalId = playnite:<Game.Id>
```

El título no debe usarse como ID porque puede cambiar. El script actual está en `playnite-before-game-start.ps1`.

Playnite puede enviar poster y fondo como Data URI. BBQ los comprime y guarda bajo `data/assets/playnite` antes de persistir rutas en SQLite.

Un evento `started` normalmente:

- crea o actualiza el juego;
- actualiza `lastActivityAt`;
- elimina Achicharrado según configuración;
- actualiza el contenido actual y el toast;
- no crea una notificación persistente.

## Tautulli y Plex

Tautulli envía un payload mínimo a:

```text
POST /webhook/tautulli
```

```json
{
  "event": "{action}",
  "ratingKey": "{rating_key}"
}
```

El adaptador consulta Plex porque el `ratingKey` por sí solo no contiene título, tipo, serie principal, episodio ni assets.

Eventos habituales:

- `play`: reproducción iniciada;
- `watched`: contenido visto;
- `recently_added`: contenido añadido.

Para episodios, BBQ debe conservar el detalle del episodio y no sustituirlo permanentemente por “Serie” al mover el ítem. Las películas y series usan aliases canónicos distintos, pero una película mal clasificada históricamente debe resolverse por `ratingKey` y consolidarse en la identidad correcta.

Las imágenes se descargan y almacenan bajo `data/assets/plex`.

## ARR

`POST /webhook/arr/:source` acepta eventos de aplicaciones ARR. El adaptador está en `src/adapters/arr.js`. Las futuras integraciones deben seguir el mismo patrón en vez de escribir directamente en los stores.

## Toast de contenido actual

El toast representa el último ítem introducido, actualizado o notificado según configuración. No es una captura inmutable del evento inicial. Si el mismo ítem cambia de estado, la ficha y el estado persistido del toast deben reflejar la versión actual del ítem.

## Caché de imágenes Plex

Plex aplica la misma canalización a todas las entidades: películas, series, temporadas y episodios. Se cachean y normalizan tanto la carátula y el fondo del evento como la carátula y el fondo de la serie principal (`posterUrl`, `backdropUrl`, `showPosterUrl` y `showBackdropUrl`). Las referencias resultantes apuntan a `/assets/plex/...`; SQLite no almacena el contenido binario. Cuando varios campos apuntan a la misma URL dentro de un evento, se reutiliza el mismo asset para evitar descargas y ficheros duplicados.
