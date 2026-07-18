# BBQueue

BBQueue es una aplicación web local para organizar películas, series, juegos y otros tipos de contenido. Integra Plex/Tautulli y Playnite, mantiene una biblioteca única y ofrece cuatro espacios fijos: Base de datos, Backlog, On Deck y Colección.

## Inicio rápido

```bash
npm install
cp .env.example .env
npm start
```

La aplicación usa archivos JSON dentro de `DATA_DIR` como persistencia actual. La próxima fase prevista es migrar esa capa a SQLite sin cambiar los contratos públicos de la API.

## Comprobaciones

```bash
npm run check
```

La comprobación valida sintaxis JavaScript, rutas HTTP duplicadas y residuos de documentación histórica.

## Documentación

Empieza por [`docs/00-INDICE.md`](docs/00-INDICE.md).

## Estado del proyecto

- Versión actual: **6.15.0**.
- Persistencia actual: JSON.
- Arquitectura: servidor Express monolítico, almacenes separados, frontend modular sin framework.
- Próxima prioridad: SQLite, separación de rutas/servicios y pruebas de regresión.


## v6.14.3 — Toasts de actividad

Los eventos con `behavior.showToast: true` muestran un toast aunque los toasts del centro de notificaciones estén desactivados. Esta decisión es explícita por evento y no crea notificaciones persistentes. Los eventos `playnite/started` actualizan además el indicador de contenido actual.
