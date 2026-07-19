# Integraciones

## Regla general

Cada integración traduce sus datos al contrato común de BBQ. Los campos propios del proveedor no se convierten automáticamente en campos públicos. Solo se conservan identificadores técnicos imprescindibles para resolver futuras actualizaciones.

## Plex y Tautulli

Plex es la fuente autoritativa del tipo. Tautulli aporta el evento y el `ratingKey`; BBQ consulta Plex para resolver la entidad.

- película: `type/collectionType = movies`, contexto normalmente vacío;
- episodio: actualiza la entidad serie, `context = SxxExx`;
- evento añadido: `detail = Añadido`;
- reproducción: `detail = Reproducido`;
- visto: `detail = Terminado`.

El `ratingKey` de una película o la clave de la serie se mantiene como identidad técnica. Director, estudio, género y otros datos de catálogo no forman parte del contrato común salvo una futura necesidad concreta.

## Playnite

- `title`: nombre del juego;
- `type = games`;
- `context`: plataforma o texto de plataformas;
- `detail`: `Iniciado`, `Actualizado` o `Terminado`;
- identidad técnica: `gameId`.

Desarrolladores, publishers, géneros y tiempo jugado no son necesarios para el funcionamiento principal de BBQ.

## Subtipo

Las integraciones no envían `subtype` normalmente. El usuario lo administra desde la edición del actividad. Puede utilizarse para listas dinámicos y para el cupo de On Deck.

## Subtipo enviado por Tautulli

El webhook acepta el campo común opcional `subtype`. Puede rellenarse directamente con el nombre de la biblioteca de Tautulli:

```json
{
  "event": "{action}",
  "ratingKey": "{rating_key}",
  "mediaType": "{media_type}",
  "subtype": "{library_name}",
  "title": "{title}",
  "seasonNumber": "{season_num}",
  "episodeNumber": "{episode_num}",
  "timestamp": "{timestamp}"
}
```

- Con texto: establece o actualiza el Subtipo.
- Omitido o vacío: conserva el Subtipo existente.
- El valor participa en listas dinámicos y en el límite efectivo de On Deck.
