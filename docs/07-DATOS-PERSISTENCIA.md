# 07 · Datos y persistencia

## Directorio de datos

La aplicación usa `DATA_DIR` para guardar persistencia.

En Docker/Portainer se recomienda:

```env
DATA_DIR=/app/data
```

En el despliegue habitual, `/app/data` apunta a un volumen persistente.

## Ficheros principales

| Fichero | Contenido |
|---|---|
| `state.json` | Estado global persistente básico. |
| `settings.json` | Configuración. |
| `backlog.json` | Items de Backlog por fuente. |
| `on-deck.json` | Items activos en On Deck. |
| `completed-items.json` | Colecciones/completados. |
| `collection-groups.json` | Grupos manuales/dinámicos/mixtos. |
| `notifications.json` | Notificaciones recientes. |
| `notification-idempotency.json` | Control de duplicados de notificaciones. |

## Assets

Los assets cacheados se guardan bajo:

```text
data/assets/
```

Buckets habituales:

```text
data/assets/plex
data/assets/playnite
```

Kiosko cachea imágenes remotas para evitar exponer tokens y mejorar rendimiento.

## Persistencia write-behind

Desde la línea v5.9.x final, Kiosko usa persistencia diferida y agrupada para varios stores.

Objetivo:

```text
acción de usuario
→ actualizar memoria
→ responder rápido
→ escribir JSON en segundo plano
```

Variable:

```env
PERSIST_DEBOUNCE_MS=350
```

Esto reduce bloqueos al realizar acciones como:

- mover a On Deck;
- puntuar;
- borrar;
- devolver a Backlog.

## Snapshot público saneado

El snapshot público elimina datos pesados como:

```text
meta.raw
```

Esto reduce el payload enviado al frontend.

Los datos completos pueden seguir existiendo en disco cuando son necesarios para restaurar contexto interno.

## Exportación

La aplicación conserva endpoint de exportación JSON.

En v6.0 no se incluye sistema de backup automático ni restauración desde UI.

## Tamaños y diagnóstico

`/api/diagnostics` muestra tamaños de ficheros:

```json
{
  "files": {
    "backlog.json": {
      "exists": true,
      "bytes": 12345,
      "modifiedAt": "..."
    }
  }
}
```

También muestra conteos:

```json
{
  "counts": {
    "backlog": {
      "plex": 10,
      "playnite": 5,
      "total": 15
    },
    "onDeck": 3,
    "completions": 120,
    "collectionGroups": 8,
    "notifications": 20
  }
}
```

## Consideraciones de disco

Si `/app/data` está en NAS, volumen remoto o disco lento, puede afectar a:

- escrituras JSON;
- cacheo de assets;
- lectura inicial;
- snapshot.

Para diagnosticar:

```env
TRACE_ITEMS=1
TRACE_WS=1
SLOW_API_LOG_MS=500
```

Y revisar:

- `[persist]`;
- `[slow-api]`;
- `/api/diagnostics`.

## No editar en caliente

No se recomienda editar manualmente los JSON mientras la aplicación está arrancada.

Si se edita manualmente:

1. detener contenedor;
2. editar;
3. validar JSON;
4. arrancar contenedor.
