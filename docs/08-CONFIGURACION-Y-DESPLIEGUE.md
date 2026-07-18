# Configuración y despliegue

## Variables principales

Consulta `.env.example` y `.env.production.example`. No guardes tokens reales en el repositorio.

Variables relevantes:

- puerto y host;
- `DATA_DIR`;
- URL y token de Plex/Tautulli;
- límites de payload;
- diagnóstico HTTP;
- ajustes de caché y descargas.

## Ejecución local

```bash
npm install
npm start
```

## Docker

`Dockerfile` y `docker-compose.yml` siguen usando algunos identificadores internos históricos de Kiosko para conservar compatibilidad con volúmenes existentes. Cambiarlos exige migrar o renombrar el volumen.

## PWA

`manifest.webmanifest` y `service-worker.js` usan la marca BBQueue. Incrementa el nombre de caché cuando cambien recursos críticos para evitar servir archivos antiguos.
