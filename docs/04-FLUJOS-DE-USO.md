# 04 · Flujos de uso

## Flujo principal

```text
Evento externo o acción manual
→ Backlog
→ On Deck
→ Colecciones
```

No todos los elementos pasan por todas las fases. Algunos pueden ir directamente a Colecciones o quedarse sólo como notificación.

## Película nueva de Plex

1. Plex añade una película.
2. Tautulli envía evento.
3. Kiosko obtiene metadata de Plex.
4. Se normaliza el item.
5. Entra en Backlog si la fuente Plex recientemente añadido está activa.
6. Puede aparecer una notificación/toast.
7. El usuario decide:
   - verla después: On Deck;
   - marcarla como vista: Colecciones;
   - descartarla: borrar del Backlog.

## Episodio nuevo de Tautulli `created`

Desde v6.0:

1. Tautulli envía `created`.
2. Kiosko lo interpreta como contenido añadido.
3. Si es episodio:
   - entra en Backlog como novedad de episodio;
   - conserva relación con la serie;
   - si la serie está en On Deck, la tarjeta muestra “Serie en On Deck”.
4. Si el usuario manda el episodio a On Deck, el servidor lo canonicaliza a serie.

Ejemplo:

```text
Tautulli: created · The X-Files S01E24
Backlog: The X-Files · Nuevo episodio · S01E24
On Deck: The X-Files
```

## Serie ya en On Deck y episodio nuevo

Comportamiento deseado:

```text
Serie en On Deck: sí
Episodio nuevo: entra en Backlog igualmente
Backlog indica: Serie en On Deck
```

Esto permite usar Backlog como bandeja de novedades sin duplicar el seguimiento principal.

## Juego iniciado desde Playnite

1. Playnite envía webhook o script.
2. Kiosko normaliza el juego.
3. Si no está ya completado o en On Deck, puede entrar en Backlog.
4. Si ya está en On Deck, se actualiza actividad.
5. El usuario puede:
   - dejarlo en Backlog;
   - añadirlo a On Deck;
   - marcarlo como terminado;
   - puntuarlo.

## Marcar como visto/terminado

Al puntuar o completar:

```text
Backlog / On Deck / Actual
→ Colecciones
```

Efectos:

- se crea o actualiza entrada en Colecciones;
- se elimina de On Deck si estaba allí;
- se elimina de Backlog si aplica;
- se emite evento delta;
- el frontend actualiza vistas locales.

## Devolver de On Deck a Backlog

1. El usuario abre item en On Deck.
2. Pulsa devolver a Backlog.
3. Kiosko quita de On Deck.
4. Crea/actualiza entrada en Backlog.
5. Emite evento delta `item:moved-to-backlog`.

## Borrar item

Puede borrarse de:

- Backlog;
- On Deck;
- Colecciones.

Cada acción emite un evento delta específico.

## Asignar grupos

Desde una ficha:

1. El usuario abre el selector de grupos.
2. Marca o desmarca grupos.
3. El backend guarda pertenencia manual.
4. Se emite `collection-groups:update`.
5. Las vistas recalculan chips/filtros.

## Búsqueda y filtros

Cada vista mantiene filtros locales:

- tipos;
- grupos;
- búsqueda;
- coincidencia.

La vista no cambia globalmente para otros dispositivos. Cada navegador mantiene su estado local.
