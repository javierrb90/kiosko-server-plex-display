# Auditoría técnica — 6.14.0

## Limpieza realizada

- eliminadas decenas de notas de versión antiguas y documentos duplicados;
- sustituido el README obsoleto;
- eliminado un helper de listas no importado;
- unificada la ruta duplicada `/api/health`;
- actualizados branding y versión visibles;
- añadido un chequeo estructural automatizado.

## Hallazgos prioritarios

### 1. `server.js` concentra demasiadas responsabilidades

Contiene cerca de un centenar de funciones y decenas de rutas. Debe dividirse en rutas, servicios de aplicación y dominio antes o durante SQLite.

### 2. Persistencia duplicada

El registro canónico se sincroniza con Backlog, On Deck y finalizaciones en archivos separados. Esto causa lógica repetida y riesgo de estados divergentes.

### 3. Rutas heredadas y canónicas conviven

Existen rutas por `canonicalId` y rutas antiguas por store/origen. Deben inventariarse, migrarse los consumidores y deprecarse.

### 4. CSS acumulativo

`style.css` conserva capas de parches identificadas por versiones. Funciona, pero dificulta saber qué regla es definitiva. Debe separarse por componentes y eliminar sobrescrituras antiguas con pruebas visuales.

### 5. `public/app.js` es otro monolito

Agrupa arranque, settings, cabecera, filtros y coordinación. Conviene extraer módulos de configuración, navegación e integración con API.

### 6. No hay pruebas automatizadas de dominio

Los flujos críticos —mover, terminar, valorar, actualizar series y parrilla— necesitan pruebas antes de cambiar persistencia.

### 7. Identificadores heredados

Persisten `kiosko` en fuentes, claves locales, clases CSS y Docker. Algunos son parte de datos existentes y no deben renombrarse sin migración explícita.

## Archivos que no se eliminaron deliberadamente

- adaptador ARR: tiene rutas activas;
- `current-content.js`: sigue siendo usado por actividad actual;
- stores históricos: todavía son parte de la sincronización;
- CSS versionado: retirarlo sin pruebas visuales sería arriesgado.
