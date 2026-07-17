# 02 · Terminología

## Backlog

Bandeja de entrada de elementos pendientes o novedades.

No significa “todo lo que existe en Plex/Playnite”. Sólo contiene elementos relevantes detectados por eventos o añadidos manualmente.

Ejemplos:

- película añadida a Plex;
- episodio nuevo detectado por Tautulli;
- juego iniciado en Playnite;
- contenido reproducido si la fuente de playback está activada.

## On Deck

Lista de seguimiento activo.

Representa elementos que el usuario quiere tener presentes. Para series, normalmente se guarda la serie, no cada episodio.

Ejemplo:

```text
The X-Files
```

aunque Backlog pueda contener una novedad concreta:

```text
The X-Files · Nuevo episodio · S01E24
```

## Actual

Contenido actual, reciente o activo.

Se alimenta desde eventos de Plex/Tautulli o Playnite. Puede mostrarse como toast, mini-card o vista.

## Colecciones

Historial de elementos completados, vistos o puntuados.

Un elemento llega a Colecciones cuando:

- se marca como visto;
- se marca como terminado;
- se puntúa;
- se completa desde Backlog, On Deck o Actual.

## Notificación

Aviso registrado en el sistema.

Puede venir de:

- Tautulli;
- Plex;
- Sonarr/Radarr;
- Playnite;
- endpoint externo `/api/notifications` o `/api/notify`;
- pruebas internas.

## Grupo

Agrupación de elementos de Colecciones, Backlog u On Deck.

Hay tres modos:

| Modo | Descripción |
|---|---|
| Manual | El usuario añade elementos a mano. |
| Dinámico | El grupo se calcula por reglas. |
| Mixto | Combina reglas dinámicas y elementos manuales. |

## Filtro

Restricción visual aplicada a una vista.

Tipos de filtro:

- tipo: Juegos / Películas / Series;
- grupo;
- coincidencia de grupos: Cualquiera / Todos;
- búsqueda textual.

## Coincidir

Selector que define cómo se combinan varios grupos activos:

| Valor | Significado |
|---|---|
| Cualquiera | Mostrar elementos que estén en al menos un grupo seleccionado. |
| Todos | Mostrar elementos que estén en todos los grupos seleccionados. |

## Canonical ID

Identificador estable de un elemento.

Sirve para deduplicar y relacionar entradas entre vistas. Ejemplos conceptuales:

```text
plex:movies:1234
plex:series:5678
plex:episode:9999
playnite:elden-ring
```

## Rating Key

Identificador interno de Plex.

Puede referirse a película, serie, temporada o episodio. Kiosko lo usa para construir identificadores estables.

## Evento delta

Mensaje WebSocket pequeño que comunica sólo un cambio concreto.

Ejemplos:

```text
item:moved-to-deck
item:completed
item:backlog-upserted
item:deck-removed
```

Sustituye a broadcasts globales pesados para acciones de item.

## Snapshot

Carga inicial completa del estado de la aplicación.

Se obtiene por HTTP desde:

```text
GET /api/snapshot
```

Debe usarse para arranque/sincronización inicial, no como mecanismo principal para cada acción.
