# 13 · Roadmap sin backups

Este roadmap parte de v6.0 como base estable.

Quedan explícitamente fuera por decisión de producto:

- backups automáticos;
- backups manuales;
- restauración de backups;
- vista “Continuar”;
- modo salón;
- sincronización remota de vista entre dispositivos.

## Prioridad 1 · Estabilización

### 1. Reducir snapshot

Aunque v6.0 sanea `meta.raw`, conviene seguir reduciendo payload si crece.

Objetivo:

```text
snapshot < 1 MB si el número de items es razonable
```

Posibles acciones:

- paginar Colecciones en API;
- enviar sólo metadata pública estricta;
- separar snapshot inicial en partes;
- cargar Colecciones bajo demanda.

### 2. Panel visual de diagnóstico

Añadir en Opciones una sección de diagnóstico que lea `/api/diagnostics`.

Mostrar:

- WebSockets activos;
- snapshot bytes;
- ficheros grandes;
- últimas acciones;
- últimas APIs lentas;
- últimos broadcasts.

### 3. Limpieza de metadata

Añadir utilidad interna para limpiar metadata antigua de items ya guardados.

No backup automático. Sólo limpieza controlada.

## Prioridad 2 · Colecciones

### 1. Orden avanzado

Permitir ordenar por:

- fecha de completado;
- rating;
- título;
- año;
- tipo;
- fuente.

### 2. Filtros avanzados

Añadir filtros por:

- nota;
- año;
- plataforma;
- género;
- desarrollador;
- publisher.

### 3. Estadísticas

Vista/resumen de Colecciones:

- total de juegos;
- total de películas;
- total de series;
- nota media;
- completados por mes;
- plataformas más frecuentes;
- géneros más frecuentes.

## Prioridad 3 · Grupos

### 1. Mejor editor de reglas

Facilitar creación de grupos dinámicos.

### 2. Duplicar grupo

Crear copia de grupo existente para modificar reglas.

### 3. Ordenar grupos

Orden manual para grupos visibles.

### 4. Colores por grupo

Asignar color visual a grupos.

## Prioridad 4 · UX

### 1. Deshacer acciones

Para:

- borrar de Backlog;
- borrar de On Deck;
- borrar de Colecciones;
- puntuar por error.

### 2. Animaciones suaves

Para:

- mover a On Deck;
- completar;
- borrar;
- aparecer item nuevo en Backlog.

### 3. Toasters más informativos

Ejemplos:

```text
Añadido a On Deck
Marcado como visto
Devuelto al Backlog
Nuevo episodio en Backlog
```

## Prioridad 5 · Integraciones

Sólo si la base sigue estable:

- Jellyfin/Emby;
- Trakt;
- TMDB;
- IGDB/RAWG;
- Steam.

Evitar añadir integraciones antes de cerrar rendimiento y diagnóstico.
