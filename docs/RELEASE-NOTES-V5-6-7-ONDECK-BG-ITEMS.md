# v5.6.7 · Fix On Deck bg e items

- Corregido el problema real del fondo de On Deck: la vista no estaba montando la capa `data-section-bg`.
- On Deck ahora pinta su fondo con `backdrop/poster` y fallbacks desde `meta`.
- Añadidas trazas `[Kiosko On Deck BG]` para verificar items/fondos detectados.
- Colecciones muestra la consola/plataforma de juegos si existe, en vez de quedarse sólo con `Juego`.
- CompletionStore preserva el subtítulo/plataformas al completar juegos.
- Texto de cards siempre alineado a la izquierda.
