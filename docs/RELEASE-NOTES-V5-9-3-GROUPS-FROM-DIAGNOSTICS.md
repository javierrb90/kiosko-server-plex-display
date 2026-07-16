# v5.9.3 · Grupos desde base diagnostics

Base: v5.8.3 diagnostics, que ya confirmó arranque correcto.

Incluye:
- Diagnóstico de arranque de v5.8.3:
  - bind 0.0.0.0;
  - IPs locales en log;
  - `/api/health`;
  - `/api/diagnostics`;
  - log HTTP básico.
- Backend de grupos:
  - `data/collection-groups.json`;
  - `/api/collection-groups`;
  - grupos manuales, dinámicos y mixtos.
- Colecciones:
  - buscador visible fuera de filtros;
  - filtros por tipos;
  - filtros por grupos existentes;
  - coincidencia cualquiera/todos;
  - tamaño de carátula;
  - items por página.
- Opciones → Colecciones:
  - crear grupos;
  - eliminar grupos.
- Ficha de item:
  - muestra grupos actuales;
  - botón `+` para añadir/quitar grupos manualmente.
