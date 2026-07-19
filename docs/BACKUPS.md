# Backups y recuperación

## Separación

BBQ exporta dos conjuntos independientes:

### Biblioteca

Incluye:

- actividads e identidad canónica;
- estados de espacios;
- actividad y fechas;
- rating, review y diario;
- listas y relaciones;
- referencias y binarios de assets.

### Configuración

Incluye:

- opciones generales;
- apariencia y CSS personalizado;
- configuración de espacios;
- tipos y listas;
- parrilla;
- integraciones;
- credenciales solo cuando el usuario lo solicita.

## Formato

El backup de Biblioteca debe ser transportable y no depender de SQLite. Los assets deben incluirse como archivos en un ZIP, no como Base64 dentro de un JSON. El backup de Configuración puede permanecer como JSON versionado.

## Restauración

La importación debe validar formato y versión antes de escribir. Los modos son reemplazar o fusionar por identidad canónica. Las acciones destructivas requieren confirmación explícita.

## Flujo entre versiones mayores

1. exportar Biblioteca y Configuración desde la versión antigua;
2. desplegar la nueva versión con `data` limpio;
3. importar Configuración;
4. importar Biblioteca;
5. validar recuentos, estados y assets.
