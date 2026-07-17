# v6.6.1 · Hotfix JSON Database Core

## Corregido

- Eliminación definitiva desde Base de datos:
  - se añade fallback `POST /api/items/:canonicalId/delete`;
  - el frontend usa el fallback para evitar errores `Cannot DELETE /api/items/...` en despliegues/proxies.
- Calificación desde Base de datos:
  - nueva ruta `POST /api/items/:canonicalId/complete`;
  - mueve el item a Colecciones y actualiza el registry.
- Fechas:
  - fecha minimalista en Base de datos, Backlog y On Deck;
  - se evita mostrar píldoras vacías.
- Reemplazo en On Deck:
  - los payloads incluyen `onDeck` completo;
  - el frontend actualiza On Deck sin esperar a refrescar.
- Nuevos items:
  - `item:backlog-upserted`, movimientos y completados fuerzan refresh de Base de datos.
- Borrado permanente:
  - el delta incluye Backlog, On Deck y Colecciones actualizados.

## Service worker

```text
kiosko-v6-6-1
```
