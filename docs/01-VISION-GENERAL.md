# 01 · Visión general

## Qué es Kiosko Media Center

Kiosko Media Center es una aplicación web local, pensada para ejecutarse en Docker/Portainer, que centraliza eventos de consumo multimedia y juegos.

La aplicación recibe información desde varias fuentes:

- Plex, normalmente a través de Tautulli.
- Playnite, mediante webhook o script local.
- Sonarr/Radarr, mediante webhooks ARR.
- Notificaciones externas genéricas.
- Acciones manuales del usuario desde la interfaz.

Con esa información construye una experiencia de seguimiento:

```text
Lo nuevo o pendiente entra en Backlog
Lo que quieres seguir activamente pasa a On Deck
Lo que terminas o puntúas pasa a Colección
Lo que ocurre ahora se muestra como Actual / toast
```

## Filosofía

La app no intenta ser una base de datos multimedia completa ni un sustituto de las herramientas externas.

Su papel es más parecido a una **mesa de control personal**:

- “¿Qué ha entrado nuevo?”
- “¿Qué estoy siguiendo ahora?”
- “¿Qué he completado?”
- “¿Qué está pasando ahora mismo?”
- “¿Qué avisos han llegado?”

## Principios de diseño

### 1. Backlog como bandeja de novedades

Backlog no es una biblioteca completa. Es una bandeja de entrada.

Puede contener:

- películas nuevas;
- episodios nuevos;
- series detectadas;
- juegos iniciados;
- entradas provenientes de Plex/Tautulli;
- entradas provenientes de Playnite.

En v6.0 los episodios nuevos de Tautulli `created` entran en Backlog como novedades aunque la serie ya esté en On Deck.

### 2. On Deck como seguimiento activo

On Deck contiene lo que el usuario está siguiendo o quiere tener a mano.

Ejemplos:

- una serie que estás viendo;
- una película pendiente;
- un juego iniciado;
- un contenido detectado como relevante.

Cuando un episodio nuevo pertenece a una serie que ya está en On Deck, la entrada del Backlog puede indicar:

```text
Serie en On Deck
```

Esto permite ver la novedad sin duplicar el seguimiento de la serie.

### 3. Colección como historial

Colección guarda lo que ya fue completado, visto, terminado o puntuado.

No es sólo un archivo: también permite filtrar, buscar y organizar con grupos.

### 4. Actual como estado efímero

Actual representa lo que está ocurriendo ahora o lo último detectado.

Puede aparecer como:

- mini-card;
- toast;
- vista `current-content`;
- estado interno usado por la UI.

No todo lo que aparece como Actual entra automáticamente en Backlog. Depende de la fuente, del evento y de la configuración.

## Qué queda explícitamente fuera de v6.0

Por decisión de producto, v6.0 no incluye:

- backups automáticos;
- backups manuales;
- vista “Continuar”;
- modo salón;
- sincronización activa de vista entre dispositivos;
- restauración de backups desde UI.

La base estable se centra en seguimiento, organización, diagnóstico y estabilidad.
