# Frontend e interfaz

## Capas de configuración

- **Opciones**: comportamiento global.
- **Lápiz del espacio**: presentación y organización persistentes del espacio actual.
- **Filtros**: estado temporal, actualmente grupos y filtro de parrilla.
- **Buscador**: filtro textual contextual sobre el espacio actual.

## Espacios fijos

- Base de datos.
- Backlog.
- On Deck.
- Colección.

Comparten `item-segment-view.js`; sus reglas se definen mediante configuración interna, no mediante plantillas independientes.

## Tarjetas

- Simple: carátula y contenido vertical.
- Normal: carátula y metadata lateral.
- Lista: representación tabular.

Las opciones globales determinan qué campos son visibles; cada espacio elige diseño, tamaño, agrupación, orden y paginación.

## Terminología visual

No llamar Colección a los grupos. Las píldoras representan grupos. Colección es exclusivamente el espacio de terminados.
