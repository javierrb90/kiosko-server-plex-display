# 05 · Integraciones

## Plex

Plex aporta metadata multimedia.

Kiosko consulta Plex usando `PlexService` para obtener:

- título;
- subtítulo;
- tipo;
- año;
- poster;
- backdrop;
- ratingKey;
- parentRatingKey;
- grandparentRatingKey;
- canonicalId;
- metadata raw cuando hace falta.

### Tipos Plex

| Tipo Plex | Uso en Kiosko |
|---|---|
| movie | Película |
| show | Serie |
| season | Temporada, normalmente canonicalizada a serie |
| episode | Episodio, puede entrar en Backlog como novedad |

## Tautulli

Tautulli es la fuente principal de eventos Plex.

Endpoints:

```text
POST /webhook
POST /webhook/tautulli
```

Eventos relevantes:

| Evento | Interpretación |
|---|---|
| play / playbackstart | Reproducción iniciada |
| pause / stop | Reproducción pausada/detenida |
| watched / scrobble | Contenido visto |
| recently_added / added / mediaadded / newmedia | Contenido añadido |
| created | Contenido creado/añadido en biblioteca |

Desde v6.0, `created` se trata como evento de biblioteca añadida.

### Episodios `created`

Si Tautulli envía:

```text
event=created
type=episode
```

Kiosko:

1. obtiene metadata de Plex;
2. crea entrada en Backlog como novedad de episodio;
3. relaciona esa entrada con la serie;
4. indica si la serie está en On Deck.

## Playnite

Playnite aporta actividad de juegos.

Puede enviar:

- título;
- plataformas;
- desarrolladores;
- publishers;
- géneros;
- año;
- tiempo jugado;
- carátula;
- fondo;
- id del juego.

Uso:

- juegos iniciados entran en Backlog si procede;
- juegos en On Deck actualizan actividad;
- juegos completados pasan a Colecciones.

## Sonarr/Radarr

Kiosko puede recibir webhooks ARR.

Endpoints conceptuales:

```text
POST /webhook/arr
POST /webhook/arr/:source
```

La integración ARR se usa principalmente para notificaciones y candidatos normalizados.

ARR puede detectar:

- Radarr: películas;
- Sonarr: series/episodios.

## Notificaciones externas

Endpoints:

```text
POST /api/notifications
POST /api/notify
```

Payload típico:

```json
{
  "source": "system",
  "title": "Título",
  "subtitle": "Detalle",
  "priority": "normal",
  "meta": {
    "externalId": "id-opcional"
  }
}
```

### Idempotencia

Kiosko evita duplicados usando:

- `externalId`;
- `meta.externalId`;
- header `Idempotency-Key`.

## Simulación

Existe un endpoint de simulación para pruebas:

```text
POST /api/simulate/:kind
```

Tipos habituales:

- `plex`;
- `game`;
- `grab`;
- `movie`;
- `series`;
- `plex_added`;
- `notification`.

## Configuración de integraciones

Las integraciones se configuran desde:

- variables de entorno;
- ficheros persistentes;
- opciones de la UI.

Variables útiles:

```env
PLEX_URL=
PLEX_TOKEN=
TAUTULLI_API_KEY=
```

El archivo recomendado para producción es:

```text
.env.production.example
```
