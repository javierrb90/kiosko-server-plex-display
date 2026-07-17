# Kiosko Media Center v6.5

Kiosko Media Center es una aplicación web local para centralizar novedades, seguimiento y cierre de contenido multimedia y juegos.

Su objetivo no es sustituir a Plex, Playnite, Sonarr, Radarr o Tautulli, sino actuar como una **bandeja operativa** entre esas herramientas:

```text
Novedades / actividad entrante
→ Backlog
→ On Deck
→ Colecciones
```

La versión **v6.1** marca la primera base estable del proyecto después de la fase de iteración v5.x.

## Qué resuelve

Kiosko Media Center permite ver en una única interfaz:

- películas o episodios nuevos añadidos a Plex;
- actividad de reproducción de Plex/Tautulli;
- juegos iniciados desde Playnite;
- contenido que quieres seguir, jugar o ver pronto;
- historial de contenido completado, visto o puntuado;
- notificaciones externas;
- grupos manuales y dinámicos para organizar colecciones.

## Modelo mental

La aplicación se organiza alrededor de cuatro conceptos:

| Concepto | Propósito |
|---|---|
| **Backlog** | Bandeja de novedades o candidatos pendientes. |
| **On Deck** | Contenido activo o en seguimiento. |
| **Actual** | Lo que está sonando/jugándose/reproduciéndose ahora. |
| **Colecciones** | Historial de elementos completados, vistos o puntuados. |

Además existe una capa auxiliar:

| Concepto | Propósito |
|---|---|
| **Notificaciones** | Registro de avisos externos o eventos relevantes. |
| **Opciones** | Configuración visual, integraciones, grupos y comportamiento. |

## Documentación incluida

La documentación completa está en `docs/`:

- [`docs/00-INDICE.md`](docs/00-INDICE.md)
- [`docs/01-VISION-GENERAL.md`](docs/01-VISION-GENERAL.md)
- [`docs/02-TERMINOLOGIA.md`](docs/02-TERMINOLOGIA.md)
- [`docs/03-VISTAS-E-INTERFAZ.md`](docs/03-VISTAS-E-INTERFAZ.md)
- [`docs/04-FLUJOS-DE-USO.md`](docs/04-FLUJOS-DE-USO.md)
- [`docs/05-INTEGRACIONES.md`](docs/05-INTEGRACIONES.md)
- [`docs/06-GRUPOS-Y-FILTROS.md`](docs/06-GRUPOS-Y-FILTROS.md)
- [`docs/07-DATOS-PERSISTENCIA.md`](docs/07-DATOS-PERSISTENCIA.md)
- [`docs/08-API-Y-WEBHOOKS.md`](docs/08-API-Y-WEBHOOKS.md)
- [`docs/09-ARQUITECTURA-TECNICA.md`](docs/09-ARQUITECTURA-TECNICA.md)
- [`docs/10-DESPLIEGUE-PRODUCCION.md`](docs/10-DESPLIEGUE-PRODUCCION.md)
- [`docs/11-DIAGNOSTICO-Y-LOGS.md`](docs/11-DIAGNOSTICO-Y-LOGS.md)
- [`docs/12-GUIA-PARA-AGENTES-IA.md`](docs/12-GUIA-PARA-AGENTES-IA.md)
- [`docs/13-ROADMAP-SIN-BACKUPS.md`](docs/13-ROADMAP-SIN-BACKUPS.md)
- [`docs/RELEASE-NOTES-V6-0.md`](docs/RELEASE-NOTES-V6-0.md)

## Producción

Archivo recomendado:

```text
.env.production.example
```

Configuración base:

```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
DATA_DIR=/app/data
MAX_PAYLOAD_MB=25
DEBUG_HTTP=0
SLOW_API_LOG_MS=750
PERSIST_DEBOUNCE_MS=350
TRACE_ITEMS=0
TRACE_WS=0
TRACE_PAYLOAD_BYTES=250000
```

## Nota importante

La v6.0 **no incluye backups automáticos** ni sistema de restauración. Tampoco incluye vista “Continuar” ni modo salón/sincronización entre dispositivos. Esas líneas quedan explícitamente fuera de esta base estable.


## v6.1 · Item Registry

v6.1 añade la base de datos permanente interna de items:

```text
data/items.json
```

Las vistas existentes siguen funcionando igual, pero ahora todo item que pasa por Backlog, On Deck o Colecciones queda registrado en una capa común para futuras vistas y exportaciones.


## v6.5 · Fase 2

v6.5 completa la segunda fase del plan v6.x:

- vista Base de datos sobre Item Registry;
- límite de On Deck de 3 items por categoría;
- modal de reemplazo cuando se alcanza el límite;
- modo Grid/Lista en las vistas principales;
- exportación CSV de vistas filtradas.


## v6.6 · JSON Database Core

Esta versión consolida la base de datos JSON migrable:

- `items.json` pasa a schema versionado con entidades permanentes.
- `item-activity.json` registra actividad asociada a items.
- `backlog-entries.json` prepara Backlog como bandeja de recientes.
- Las series son la entidad principal; episodios y temporadas actualizan la serie mediante actividad.
- Base de datos permite eliminar definitivamente un item de todas las vistas.
- Las fechas principales son `firstSeenAt`, `lastActivityAt` y `completedAt`.
- El centro de notificaciones sigue independiente en JSON.

## v6.7 · Item Detail & Tracking

- Backlog pasa a ser seguimiento manual de actividad.
- La ficha del item se reorganiza con acciones contextuales y menú `…`.
- Diseño y metadata de ficha se configuran desde Opciones → Ficha.
- Calificar ya no retira automáticamente de On Deck.
- Base de datos se refresca en tiempo real también con Playnite.
