# Modelo de dominio

## Propósito

BBQ ayuda a elegir, mantener activas y terminar actividades. No pretende duplicar el catálogo completo de Plex, Playnite u otras plataformas. El modelo público se limita a datos que sirven para identificar, organizar, mostrar y completar un actividad.

## Campos comunes

Campos principales:

- `canonicalId`: identidad estable de integración.
- `source`: origen (`plex`, `playnite`, `manual`, etc.).
- `externalId`: identidad técnica del proveedor cuando aplica.
- `title`: título visible.
- `type`: categoría principal.
- `poster` y `backdrop`: rutas o URL de assets.
- `lastActivityAt`, `completedAt`, `rating` y `states`.

Campos extra opcionales:

- `subtype`: clasificación manual del usuario, por ejemplo `horror` o `roguelike`.
- `context`: unidad, plataforma o punto actual, por ejemplo `PC`, `S02E05` o `Capítulo 8`.
- `detail`: descripción breve del evento o estado legible, por ejemplo `Iniciado`, `Reproducido` o `Terminado`.

Los tres son opcionales. Al recibir una actualización:

- campo omitido: conserva el valor existente;
- `null` o cadena vacía: elimina el valor;
- texto: establece el nuevo valor.

Las integraciones no deben modificar `subtype` salvo que lo envíen expresamente. Su uso normal es manual.

## Terminología

- **Tipo**: qué clase principal de actividad es: película, serie, juego o tipo personalizado.
- **Subtipo**: cómo la clasifica el usuario: horror, roguelike, documental.
- **Contexto**: dónde, en qué plataforma o por qué parte va: PC, S02E05, capítulo 8.
- **Detalle**: qué ha ocurrido o cuál es el estado legible: añadido, reproducido, iniciado.

## Espacios

- **Actividades**: catálogo completo.
- **Backlog**: pendiente.
- **On Deck**: activo o prioritario.
- **Colección**: terminado.

Las acciones normales mantienen Backlog, On Deck y Colección como estados excluyentes.

## Listas

Los listas son transversales a los espacios.

- **Manual**: el usuario añade o retira actividads desde la ficha.
- **Dinámico**: la pertenencia se calcula mediante reglas.
- **Mixto**: combina reglas y altas manuales.

Las reglas dinámicas trabajan sobre campos comunes: título, tipo, subtipo, contexto, detalle, estado, fuente y año. El uso recomendado para clasificaciones personales es `subtype`; el uso recomendado para plataforma o parte actual es `context`.

Ejemplo:

```text
Lista: Horror
Regla: subtype es exactamente horror
```

## Límite de On Deck

El límite de tres elementos se aplica a una categoría efectiva:

1. `subtype`, cuando existe;
2. `type`, cuando no existe subtipo.

Dos actividads con subtipo `horror` comparten el mismo cupo aunque sus tipos principales sean distintos. Los actividads sin subtipo utilizan el cupo de su tipo.

## Identidad técnica

`items.id` es un UUID interno de SQLite. No debe derivarse de IDs externos. `canonicalId` es el contrato estable usado por la API, la UI y las integraciones.


## Listas dinámicos (v7.2.1)

Las reglas dinámicas expuestas en la interfaz se basan únicamente en `subtype`. Los listas manuales se gestionan desde la ficha; los mixtos combinan ambas fuentes. El valor dinámico se compara con `contains` sin distinguir mayúsculas y minúsculas.
