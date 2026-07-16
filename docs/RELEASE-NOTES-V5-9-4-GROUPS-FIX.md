# v5.9.4 · Fix grupos

- Evita que la creación de grupos genere duplicados:
  - protección frontend contra doble click/doble handler;
  - creación idempotente en backend por nombre + modo + reglas;
  - deduplicado al cargar `data/collection-groups.json`.
- Corrige filtros por grupos:
  - reglas dinámicas más robustas;
  - plataforma detectada desde `platforms`, `meta.platforms`, `platform`, `meta.platform` y `subtitle`;
  - soporte de campos plurales/singulares.
- El panel de filtros actualiza el contador de grupos activos.
- Se conserva la base de diagnóstico:
  - logs de IPs;
  - `/api/health`;
  - `/api/diagnostics`.
