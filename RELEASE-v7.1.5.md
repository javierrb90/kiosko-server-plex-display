# BBQ v7.1.5 — Laboratorio de debug y tipado Plex autoritativo

## Cambios

- La ficha JSON continúa siendo la fuente de diagnóstico por ítem.
- Plex impone de forma autoritativa el tipo resuelto: `movie` corrige `type` y `collectionType` a película, incluso si el registro histórico decía serie.
- Los campos exclusivos de serie se eliminan al corregir una película.
- Datos y diagnóstico incorpora un laboratorio completo para:
  - notificaciones personalizadas;
  - eventos Plex/Tautulli reales o sintéticos;
  - eventos Playnite sintéticos.
- Un ID vacío crea una prueba nueva; reutilizar el mismo `ratingKey`, `gameId` o ID de debug actualiza la misma entidad.
- El historial registra exclusivamente ejecuciones del laboratorio y puede borrarse desde la interfaz.
- Los simuladores usan el favicon como asset de prueba y pasan por los flujos reales de ingestión.

## Pruebas rápidas

### Plex real

1. Abre **Opciones → Datos y diagnóstico → Debug**.
2. En Plex/Tautulli elige **Consultar Plex por ratingKey**.
3. Introduce el `ratingKey`, selecciona el evento y envía.
4. Abre la ficha del ítem y usa `{ }` para inspeccionar el JSON.

### Plex sintético

1. Selecciona **Evento sintético**.
2. Introduce un ID de debug y un tipo.
3. Reutiliza el mismo ID para comprobar una actualización.

### Playnite

1. Deja el ID vacío para crear un juego nuevo.
2. Copia su `gameId` o `canonicalId` desde el JSON.
3. Reutiliza el mismo ID para actualizarlo.
