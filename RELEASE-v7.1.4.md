# BBQ v7.1.4

## Tautulli y Plex

Plex es la fuente de verdad del tipo de contenido. `mediaType` del webhook se conserva como señal de diagnóstico, pero nunca puede convertir una película en serie. Los eventos de contenido añadido, reproducción y visto comparten el mismo flujo de ingestión.

Un episodio nuevo actualiza la entidad de su serie mediante `grandparentRatingKey`, registra actividad, actualiza el detalle visible y mantiene el espacio actual. La notificación de biblioteca y la retirada de Achicharrado siguen siendo efectos configurables e independientes.

## Depuración

La ficha incluye un botón `{ }` que abre el JSON completo servido por `/api/items/:canonicalId`, con botón para copiarlo.
