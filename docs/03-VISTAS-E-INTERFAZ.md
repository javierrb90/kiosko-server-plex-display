# 03 · Vistas e interfaz

## Estructura general

La interfaz está pensada como un media center local con estética de panel oscuro.

Elementos globales:

- dock superior/lateral con accesos a vistas;
- botón de notificaciones;
- botón de opciones;
- indicadores de vista activa;
- mini-card/toast para contenido actual;
- modales para detalle de item, filtros y configuración.

La app está optimizada para escritorio y móvil.

## Backlog

### Propósito

Backlog es la bandeja de entrada.

Muestra novedades, candidatos y elementos pendientes procedentes de integraciones o acciones manuales.

### Qué puede aparecer

- películas nuevas de Plex;
- episodios nuevos de Tautulli `created`;
- contenido reproducido de Plex si la fuente playback está activada;
- juegos iniciados desde Playnite;
- elementos devueltos desde On Deck.

### Orden

Los elementos se agrupan temporalmente:

```text
HOY
AYER
ÚLTIMA SEMANA
ANTERIOR
```

### Controles

Backlog incluye:

- título con contador;
- filtros de tipo:
  - Juegos;
  - Películas;
  - Series;
- buscador;
- botón de filtros;
- filtros por grupos;
- selector Cualquiera / Todos si hay varios grupos activos;
- paginación.

En móvil, el buscador superior se oculta y queda dentro del modal de filtros.

### Tarjetas

Una tarjeta puede mostrar:

- poster;
- fondo/backdrop;
- título;
- subtítulo;
- rating si ya existe;
- grupos;
- aviso “Serie en On Deck” si la entrada es un episodio relacionado con una serie ya seguida.

### Acciones habituales

Desde una ficha de Backlog:

- añadir a On Deck;
- puntuar / marcar como visto o terminado;
- borrar del Backlog;
- asignar grupos.

## On Deck

### Propósito

On Deck contiene contenido activo o en seguimiento.

No es una bandeja de novedades. Es la lista de cosas que el usuario quiere tener presentes.

### Ejemplos

- serie en seguimiento;
- juego iniciado;
- película pendiente;
- contenido añadido desde Backlog o Actual.

### Canonicalización de series

Si un episodio o temporada se manda a On Deck, Kiosko intenta convertirlo a la serie completa.

Ejemplo:

```text
Backlog: The X-Files · Nuevo episodio · S01E24
On Deck: The X-Files
```

Esto evita llenar On Deck con episodios individuales.

### Acciones

- devolver a Backlog;
- puntuar / completar;
- quitar de On Deck;
- asignar grupos.

## Actual

### Propósito

Actual muestra el contenido que está ocurriendo ahora o lo último detectado.

Puede venir de:

- reproducción de Plex;
- evento de Tautulli;
- juego iniciado desde Playnite.

### Representaciones

- mini-card;
- toast;
- vista interna `current-content`.

### Acciones

Desde Actual se puede:

- añadir a On Deck;
- marcar como completado;
- ver estado:
  - On Deck;
  - Backlog;
  - Colección;
  - sin clasificar.

## Colección

### Propósito

Colección es el historial.

Contiene contenido visto, terminado, completado o puntuado.

### Qué muestra

- juegos completados;
- películas vistas;
- series marcadas o puntuadas;
- ratings;
- fechas;
- grupos.

### Controles

- filtros de tipo;
- grupos;
- coincidencia Cualquiera / Todos;
- buscador;
- paginación;
- fichas de detalle.

### Uso principal

Colección sirve para consultar, filtrar y organizar el historial.

## Notificaciones

### Propósito

Notificaciones registra eventos y avisos.

Puede incluir:

- contenido añadido;
- pruebas de webhook;
- avisos externos;
- eventos ARR;
- eventos Plex/Tautulli;
- mensajes personalizados.

### Comportamiento

Las notificaciones pueden aparecer como toast y quedar registradas en el centro de notificaciones.

## Opciones

### Propósito

Opciones centraliza configuración y administración.

El contenido exacto puede evolucionar, pero en v6.0 incluye áreas como:

- configuración general;
- comportamiento de vistas;
- integraciones;
- diseño;
- grupos de colecciones;
- filtros;
- diagnóstico básico.

## Modal de ficha

Cada item abre una ficha de detalle.

La ficha puede mostrar:

- título;
- subtítulo;
- poster;
- metadata;
- estado actual;
- grupos;
- acciones contextuales;
- rating;
- botones de movimiento entre vistas.

La ficha es dinámica: al mover o puntuar un item, actualiza su estado sin cerrar obligatoriamente el modal.

## Modal de filtros

Cada vista con filtros puede abrir un modal.

Incluye:

- filtros por tipo;
- filtros por grupo;
- coincidencia Cualquiera / Todos;
- buscador en móvil;
- tamaño visual de tarjeta cuando aplica.

## Responsive móvil

En móvil:

- se evita que el buscador compita con iconos superiores;
- el buscador se mueve al modal de filtros;
- las botoneras se compactan;
- las tarjetas reducen columnas según tamaño;
- los filtros se adaptan para evitar solapes.
