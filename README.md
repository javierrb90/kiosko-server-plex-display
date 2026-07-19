# BBQ

BBQ es una aplicación local y autocontenida para gestionar una biblioteca personal de películas, series, juegos y otros tipos de contenido. Su idea central no es almacenar una lista pasiva, sino ayudar a decidir **qué consumir ahora**, qué mantener pendiente y qué ya forma parte de la colección.

## Espacios de trabajo

En **Actividades**, una botonera contextual permite filtrar rápidamente por **Sin organizar**, **Backlog**, **On Deck** y **Colección**. Los botones actúan como segmentos visibles y se combinan con los demás filtros.


BBQ usa cuatro espacios fijos:

- **Actividades**: catálogo completo. Todo actividad existe aquí.
- **Backlog**: contenido pendiente que aún no está en consumo activo.
- **On Deck**: selección prioritaria o actualmente activa.
- **Colección**: contenido terminado.

Los espacios son reglas de dominio, no carpetas independientes. Un actividad conserva una única identidad canónica y su pertenencia se representa mediante estados. Los **listas** son etiquetas organizativas creadas por el usuario y no deben confundirse con Colección.

## Modelo común

Además del título y el tipo, BBQ usa tres campos extra opcionales:

- **Subtipo**: clasificación manual, como Horror o Roguelike.
- **Contexto**: plataforma o unidad actual, como PC o S02E05.
- **Detalle**: evento o estado legible, como Iniciado o Reproducido.

Los listas dinámicos pueden usar estos campos. El límite de On Deck se calcula por subtipo y, cuando no existe, por tipo.

## Parrilla

La parrilla utiliza la fecha de actividad para detectar contenido olvidado:

- **Quemándose**: se acerca al límite configurado.
- **Achicharrado**: ha superado el límite.
- **Dar la vuelta**: actualiza la actividad a ahora y evita que el actividad se queme.

El botón Dar la vuelta solo aparece en Backlog y On Deck. No aparece en Actividades ni en Colección.

## Instalación

Requisitos: Node.js 22.5 o posterior.

```bash
npm ci
npm start
```

La aplicación escucha por defecto en `http://localhost:3000`. Toda la persistencia vive en `/app/data`. El `docker-compose.yml` incluido lo monta mediante un bind hacia `/var/mnt/nas/MHDisk/bbq`.

## Persistencia

```text
data/
├── bbqueue.sqlite       # biblioteca, estados y actividad
├── assets/              # imágenes normalizadas y comprimidas
├── backups/             # copias generadas por la aplicación
└── *.json               # configuración y almacenes auxiliares
```

SQLite guarda datos estructurados y rutas. Las imágenes no deben almacenarse como Base64 ni como BLOB: pasan por `src/asset-service.js`, se convierten normalmente a WebP y se escriben bajo `data/assets`.

## Integraciones

- Playnite: `POST /api/v1/events`
- Tautulli/Plex: `POST /webhook/tautulli`
- ARR: `POST /webhook/arr/:source`
- API genérica: `POST /api/v1/items/upsert` y `POST /api/v1/events`
- Contrato de ingestión: `GET /api/v1/ingestion/schema`

## Seguridad

La interfaz puede protegerse mediante HTTP Basic:

```env
BBQ_AUTH_USER=admin
BBQ_AUTH_PASSWORD=una-clave-segura
```

La API externa puede protegerse por separado:

```env
BBQUEUE_API_TOKEN=token-de-integracion
```

## Desarrollo

```bash
npm run check
```

Valida sintaxis, estructura y rutas HTTP duplicadas.

## Documentación

Empieza por [`docs/README.md`](docs/README.md). El documento [`docs/HANDOFF.md`](docs/HANDOFF.md) resume el estado técnico y las decisiones necesarias para continuar el proyecto en otro hilo o con otro agente.

## Docker y red

La configuración incluida usa el servicio, contenedor y hostname `bbq`. El almacenamiento persistente se monta como bind:

```text
host:      /var/mnt/nas/MHDisk/bbq
container: /app/data
```

La carpeta del host debe existir y permitir escritura al usuario del contenedor antes del primer arranque.


## Terminología

La equivalencia entre nombres de producto y nombres técnicos heredados está en [`docs/TERMINOLOGY.md`](docs/TERMINOLOGY.md).
