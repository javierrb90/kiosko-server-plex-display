# BBQ v7.2.0 — Modelo común, Subtipo y Contexto

Esta versión consolida un contrato pequeño y transversal para todas las integraciones.

## Cambios

- Nuevas columnas SQLite opcionales `subtype` y `context`.
- `detail` se mantiene como estado o evento legible.
- Semántica de actualización: omitido conserva, vacío/null elimina, texto actualiza.
- Subtipo editable para cualquier ítem y protegido frente a actualizaciones ordinarias de integraciones.
- Contexto y detalle editables desde la ficha.
- Subtipo y contexto disponibles en Grid, Lista y ficha.
- Catálogo de campos de diseño simplificado a campos comunes.
- Grupos dinámicos basados en subtipo, contexto, detalle, estado, tipo, fuente, título o año.
- Límite de On Deck por subtipo con fallback al tipo.
- Plex traduce episodios a contexto `SxxExx` y eventos a detalle.
- Playnite usa plataforma como contexto y el evento como detalle.
- API y documentación actualizadas.
