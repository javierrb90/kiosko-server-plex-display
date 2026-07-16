# v5.9.18 · Snapshot ligero y persistencia write-behind

- Snapshot/API pública más ligera:
  - elimina `meta.raw` y objetos pesados del payload enviado al frontend;
  - se conservan los datos completos en disco/exportación.
- Persistencia write-behind/coalesced:
  - las acciones actualizan memoria y responden rápido;
  - los JSON se escriben en segundo plano agrupando cambios;
  - `PERSIST_DEBOUNCE_MS` configurable, por defecto 350ms.
- Logs de rendimiento:
  - `[persist]` si una escritura tarda más de 250ms;
  - `[slow-api]` si una ruta `/api/` tarda más de `SLOW_API_LOG_MS` (750ms por defecto).
- Evita escrituras innecesarias al arrancar.
- Reduce broadcasts y payloads pesados.
