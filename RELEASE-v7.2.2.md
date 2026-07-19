# BBQ v7.2.2 — Cupos y lista

## On Deck

El cupo de tres items se calcula mediante la categoría efectiva del item:

1. Subtipo normalizado, si existe.
2. Tipo, únicamente como fallback.

El cálculo consulta la clasificación más reciente del registro SQLite, por lo que una copia antigua del item en el almacén de On Deck no puede mezclar subtipos diferentes.

## Vista Lista

- Subtipo, Contexto y Detalle se muestran como una línea secundaria bajo el título.
- Se eliminan las columnas independientes de Subtipo y Contexto.
- Se separan Última actividad y Finalización.
- La calificación se muestra con estrellas.
