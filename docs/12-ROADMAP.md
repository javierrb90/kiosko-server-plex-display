# Roadmap

## Próxima fase

- pruebas de dominio y API;
- repositorios desacoplados;
- SQLite y migración de datos;
- API canónica versionada;
- retirada progresiva de rutas heredadas.

## Después

- dividir `server.js` y `app.js`;
- modularizar CSS por componentes;
- esquemas de validación para webhooks y API;
- exportación/importación de temas;
- espacios de trabajo configurables solo si aparece una necesidad real;
- mejorar observabilidad y recuperación de errores.

## Principios

- una sola fuente de verdad;
- no duplicar estado derivable;
- mantener integraciones desacopladas;
- preservar compatibilidad de datos mediante migraciones explícitas;
- priorizar cohesión sobre añadir opciones aisladas.
