# Iteración v4 · Fases 4, 5 y 6

Esta iteración continúa sobre la versión con Dashboard multimedia y vista unificada **Actual**.

## Fase 4 · Notificaciones y UX de actividad

- El centro de notificaciones queda como listado scrolleable ligero.
- Se conserva un máximo de 50 notificaciones.
- Se mantiene el botón de limpiar todas las notificaciones dentro del overlay.
- Los toasts son configurables por tamaño: `small`, `medium`, `large`.
- Se añade sonido opcional al recibir notificaciones, sin assets externos, generado mediante Web Audio.
- Nuevos ajustes persistentes:

```json
{
  "notifications": {
    "toastSize": "large",
    "soundEnabled": false,
    "soundVolume": 0.35
  }
}
```

## Fase 5 · Colecciones avanzadas

Los items de colección pasan a admitir:

- portada / carátula;
- backdrop / fondo;
- vídeo o trailer opcional;
- título editable;
- metadatos mínimos.

Endpoints añadidos o ampliados:

```http
POST /api/collections/:id/items
PATCH /api/collections/:id/items/:itemId
```

El `POST` acepta ahora:

```json
{
  "title": "Nombre del item",
  "image": "data:image/...",
  "backdrop": "data:image/...",
  "video": "data:video/..."
}
```

El `PATCH` permite actualizar título, portada, backdrop o vídeo.

## Fase 6 · Responsive vertical

Se añaden reglas específicas para orientación vertical:

- vista Actual en columna;
- carátula centrada arriba;
- texto debajo;
- Dashboard de colección en columna;
- dock adaptado a la parte inferior cuando el layout vertical no admite bien laterales;
- notificaciones y colecciones ajustadas a pantalla estrecha.

## Notas

La fase de “display skins” queda preparada conceptualmente, pero no implementada. Las vistas siguen separando `ItemVisual`/carátula del bloque de metadatos para permitir sustituir la imagen plana por un skin visual más adelante.
