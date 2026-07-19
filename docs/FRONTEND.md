# Interfaz y flujos

## Navegación

Los espacios se muestran como vistas alternativas. Los controles específicos del espacio —presentación, filtros y edición— viven junto al título; búsqueda global, filtro de Achicharrados y opciones permanecen en la cabecera global.

## Configuración y filtros

- La configuración persistente del espacio incluye tipos visibles, presentación, tamaño, agrupación, orden y paginación.
- Los filtros temporales incluyen listas, búsqueda y Achicharrados.
- Al seguir un actividad movido se limpian los filtros temporales.
- Si su tipo estaba oculto en el destino, se activa y se guarda hasta que el usuario vuelva a modificarlo.

## Movimiento entre espacios

1. guardar la operación;
2. cerrar la ficha;
3. limpiar filtros temporales;
4. activar el tipo del actividad si estaba oculto;
5. navegar al destino;
6. localizar página y nodo;
7. hacer scroll;
8. mostrar feedback de colocación.

En Lista se ilumina la fila. Al completar y llegar a Colección se lanza una ráfaga de confeti desde el nodo de destino.

## Dar la vuelta

- Solo se muestra en Backlog y On Deck.
- En diseño Normal aparece arriba a la derecha de la tarjeta.
- En diseño Simple aparece arriba a la derecha de la carátula.
- Muestra los días desde la última actividad (`↻ 0d`).
- Anima el nodo real antes de enviar la petición para impedir que un rerender corte el giro.

No debe aparecer ninguna fecha o contador equivalente en Actividades ni Colección.

## Agrupación

Puede hacerse por:

- periodos recientes;
- mes y año;
- año;
- tipo;
- lista.

La fecha base puede ser Último movimiento o Finalización. Cada encabezado muestra su total: `Hoy (3)`, `Marzo 2025 (10)` o `2026 (33)`.

## Feedback visual

- giro manual: confirmación de actividad;
- colocación: halo y entrada del actividad en el destino;
- lista: iluminación de fila;
- confeti: finalización y llegada a Colección.

Evitar duplicar una animación sobre el nodo real y un overlay al mismo tiempo. El historial del proyecto mostró que los clones flotantes deforman tarjetas y son vulnerables a los rerenders.
