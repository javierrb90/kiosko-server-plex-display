# Persistencia JSON actual

La carpeta se define mediante `DATA_DIR`. Los archivos son creados por los almacenes y no deben editarse mientras el servidor está escribiendo.

## Familias de datos

- registro canónico de ítems;
- Backlog por origen;
- On Deck;
- finalizaciones históricas;
- diario y reviews;
- grupos;
- configuración;
- estado de interfaz y actividad actual;
- eventos/notificaciones;
- recursos descargados.

## Escrituras

Los almacenes implementan colas de escritura para reducir carreras, pero una acción puede tocar varios archivos. No existe una transacción que garantice que todos queden sincronizados si el proceso falla a mitad de operación.

## Regla para nuevas funciones

Hasta completar SQLite:

1. actualizar primero el registro canónico;
2. mantener compatibilidad con almacenes heredados solo cuando la vista todavía dependa de ellos;
3. emitir un único evento de dominio después de completar las escrituras;
4. no añadir otro archivo JSON específico salvo necesidad imprescindible.
