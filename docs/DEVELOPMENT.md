# Desarrollo y despliegue

## Requisitos

- Node.js >= 22.5
- npm
- dependencias nativas de `sharp` disponibles para la plataforma

## Comandos

```bash
npm ci
npm start
npm run check
npm run check:syntax
```

## Variables de entorno

```env
PORT=3000
DATA_DIR=/app/data
PLEX_URL=http://servidor:32400
PLEX_TOKEN=token
BBQUEUE_API_TOKEN=token-api
BBQ_AUTH_USER=admin
BBQ_AUTH_PASSWORD=clave
# BBQ_HTPASSWD_FILE=/data/.htpasswd
```

## Docker

El código debe ser inmutable y `/app/data` el único volumen persistente. No montar `node_modules` desde otro sistema operativo.

## Seguridad

HTTP Basic protege la interfaz cuando se publica detrás de HTTPS. Los webhooks y `/api/v1` pueden necesitar su propio token para no romper integraciones automatizadas.

## Validación manual recomendada

- arrancar con base vacía;
- crear un ítem manual;
- ingerir un juego desde Playnite;
- reproducir contenido Plex;
- mover Base → Backlog → On Deck → Colección;
- retirar Colección → Backlog/On Deck;
- Dar la vuelta en Grid Simple y Normal;
- comprobar ausencia del botón en Base de datos y Colección;
- comprobar Lista, agrupación y confeti;
- reiniciar y verificar persistencia;
- exportar e importar Biblioteca y Configuración.

## Riesgos técnicos actuales

- `server.js` concentra demasiadas responsabilidades y debería dividirse por routers y servicios.
- `public/style.css` contiene capas históricas de overrides; conviene una limpieza por componentes.
- Existen rutas heredadas junto a la API moderna.
- Algunos stores auxiliares siguen en JSON.
- El frontend reconstruye secciones completas en varios flujos; una actualización incremental reduciría parpadeos.
