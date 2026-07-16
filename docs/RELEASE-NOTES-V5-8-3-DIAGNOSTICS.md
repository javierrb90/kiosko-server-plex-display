# v5.8.3 · Diagnóstico de red/arranque

Esta versión parte de la v5.8.2 estable y añade logs de diagnóstico:

- bind explícito a `0.0.0.0`;
- impresión de puerto, DATA_DIR, CWD, PID y Docker probable;
- listado de interfaces IPv4 locales;
- listado de URLs sugeridas;
- endpoint `/api/health`;
- endpoint `/api/diagnostics`;
- log básico de peticiones HTTP entrantes.

Pruebas recomendadas:

```bash
curl -v http://127.0.0.1:3000/api/health
curl -v http://127.0.0.1:3000/api/diagnostics
```
