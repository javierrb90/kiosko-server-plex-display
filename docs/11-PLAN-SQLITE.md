# Plan de migración a SQLite

## Objetivo

Sustituir varios JSON por una base transaccional sin cambiar de golpe el frontend ni los webhooks.

## Esquema inicial propuesto

- `items`
- `item_sources`
- `workspace_memberships`
- `activities`
- `journal_entries`
- `reviews`
- `groups`
- `group_items`
- `settings`
- `notifications`
- `assets`

`workspace_memberships` almacenaría solo membresías manuales como Backlog y On Deck. Colección se derivaría de `completed_at`.

## Fases

1. Escribir pruebas de comportamiento sobre los stores actuales.
2. Introducir interfaces de repositorio independientes del formato.
3. Crear esquema y migrador idempotente.
4. Importar JSON a SQLite conservando `canonicalId`.
5. Ejecutar temporalmente lecturas comparadas JSON/SQLite.
6. Cambiar escritura a SQLite y mantener exportación JSON.
7. Retirar stores heredados y rutas antiguas.

## Requisitos

- copia de seguridad previa;
- transacciones para movimientos entre espacios;
- índices por `canonical_id`, actividad, tipo y membresía;
- migraciones numeradas;
- rollback documentado;
- herramienta de verificación de conteos y muestras.

## Decisión recomendada

Usar SQLite mediante una librería síncrona y estable para Node o el módulo oficial disponible en la versión objetivo de Node. La elección debe cerrarse al iniciar la fase, tras verificar compatibilidad del entorno Docker.
