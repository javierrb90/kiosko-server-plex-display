# Desarrollo y diagnóstico

## Antes de entregar una versión

```bash
npm run check
```

Además:

1. arrancar con un `DATA_DIR` temporal;
2. comprobar `/api/health` y `/api/settings`;
3. probar Base de datos, Backlog, On Deck y Colección;
4. probar una actualización Plex y otra Playnite;
5. comprobar WebSocket sin recargar la página;
6. exportar un backup.

## Endpoints de diagnóstico

- `GET /api/health`: estado breve.
- `GET /api/diagnostics`: entorno, tamaños y métricas.
- `GET /api/snapshot`: estado completo usado por el frontend.

## Seguridad

La aplicación es de uso local y no implementa usuarios reales. Si se expone fuera de la red privada, debe colocarse detrás de autenticación, TLS y límites de red.
