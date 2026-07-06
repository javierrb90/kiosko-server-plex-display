# Kiosko Media Center

## Configuración

Copia `.env.example` como `.env` y completa `PLEX_URL` y `PLEX_TOKEN`.

El proyecto no usa `dotenv`: Node 22 carga `.env` de forma nativa al ejecutar `npm start`.

En Docker/Portainer, `docker-compose.yml` también inyecta el mismo archivo mediante `env_file`.


## Endpoints Tautulli

Se admiten ambas URLs para compatibilidad:

- `POST /webhook` (configuración original)
- `POST /webhook/tautulli` (ruta nueva)

Para comprobar manualmente que el centro de notificaciones funciona:

```bash
curl -X POST http://localhost:3000/api/notifications/test \
  -H "Content-Type: application/json" \
  -d '{"title":"Prueba","subtitle":"El dashboard recibe eventos"}'
```
