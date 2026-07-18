# 06 · Grupos y filtros

## Grupos

Los grupos permiten organizar elementos sin duplicarlos.

Se usan en:

- Backlog;
- On Deck;
- Colección;
- fichas de detalle;
- filtros.

## Tipos de grupo

### Manual

El usuario añade o quita items explícitamente.

Ejemplo:

```text
Grupo: Favoritos
Modo: manual
```

### Dinámico

El grupo se calcula por reglas.

Ejemplo:

```text
Plataforma contiene "Nintendo"
```

### Mixto

Combinación de reglas dinámicas y miembros manuales.

Puede ocurrir cuando un grupo dinámico recibe items añadidos manualmente.

## Reglas dinámicas

Campos habituales:

- título;
- fuente;
- tipo;
- año;
- plataforma;
- género;
- desarrollador;
- publisher.

Operadores habituales:

- contiene;
- igual;
- distinto;
- empieza por;
- termina en.

## Pertenencia manual

Los grupos guardan identificadores estables:

- `manualItemIds`;
- `manualItemKeys`.

Esto permite que un item siga perteneciendo al grupo aunque cambie ligeramente su representación.

## Filtros de tipo

Orden estándar en v6.0:

```text
Juegos · Películas · Series
```

Este orden se mantiene en:

- Backlog;
- On Deck;
- Colección;
- cabecera;
- modal de filtros.

## Filtros de grupo

Cuando se seleccionan grupos, aparecen chips activos.

Cada chip puede quitarse con `×`.

## Coincidencia

Si hay varios grupos activos, aparece selector:

```text
Cualquiera · Todos
```

### Cualquiera

Muestra items que pertenecen a al menos uno de los grupos.

### Todos

Muestra items que pertenecen a todos los grupos.

## Búsqueda

Cada vista tiene búsqueda textual.

En móvil:

- el buscador superior se oculta;
- el buscador aparece dentro del modal de filtros.

## Chips en tarjetas

Las tarjetas pueden mostrar chips de grupo.

Al pulsar un chip de grupo en una tarjeta, la vista puede filtrar por ese grupo.

## Relación con On Deck

Desde v6.0, una entrada de Backlog puede indicar:

```text
Serie en On Deck
```

Esto ocurre cuando:

- el item de Backlog es un episodio/novedad;
- la serie relacionada ya existe en On Deck.

Esta indicación no elimina el item del Backlog. Sólo informa del estado relacionado.
