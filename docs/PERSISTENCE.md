# Persistencia y assets

## Directorio `data`

Toda información persistente debe quedar bajo `DATA_DIR`:

```text
data/
├── bbqueue.sqlite
├── assets/
│   ├── plex/
│   ├── playnite/
│   ├── manual/
│   ├── journals/
│   └── uploads/
├── backups/
├── settings.json
└── otros JSON auxiliares
```

En Docker se monta un único bind persistente en `/app/data`. La configuración incluida enlaza `/var/mnt/nas/MHDisk/bbq` del host con `/app/data` del contenedor.

## SQLite

`bbqueue.sqlite` es la fuente de verdad de la biblioteca. Almacena:

- identidad canónica e interna;
- metadata estructurada;
- estado de Backlog, On Deck y Colección;
- actividad;
- fechas relevantes;
- referencias a assets.

Las migraciones de esquema SQLite se conservan para futuras versiones. No existe migración automática desde los JSON internos de v6; el flujo oficial es exportar e importar backups.

## Reglas de identidad

- `canonical_id` identifica la entidad de dominio.
- `id` es un UUID interno.
- Un `canonical_id` existente conserva su `id` de SQLite.
- Un elemento nuevo recibe un UUID nuevo.
- Los aliases Plex equivalentes deben consolidarse por `ratingKey` cuando representan la misma entidad.

## Assets

Toda imagen entrante, sin importar si procede de películas, series, temporadas, episodios, Playnite, API externa o carga manual, debe pasar por `asset-service`:

1. validar origen y tipo;
2. descargar o decodificar;
3. corregir orientación EXIF;
4. redimensionar sin ampliar;
5. convertir a WebP cuando sea compatible;
6. escribir bajo `data/assets/<source>`;
7. persistir solo la ruta `/assets/...`.

Límites orientativos actuales:

- poster: hasta 1200 × 1800, WebP de calidad aproximada 82;
- fondo: hasta 1920 × 1080, WebP de calidad aproximada 78.

No se deben guardar imágenes Base64 en columnas ni dentro de `metadata_json`. Tampoco se ejecutan saneamientos automáticos de instalaciones antiguas durante el arranque.

## Volúmenes remotos

El directorio de assets puede residir en un volumen remoto. SQLite requiere un sistema de archivos con bloqueo fiable; evitar montajes NFS/SMB cuya configuración no garantice locks y fsync coherentes.

## Bind incluido

```yaml
volumes:
  - type: bind
    source: /var/mnt/nas/MHDisk/bbq
    target: /app/data
```

El hostname de la instancia dentro de la red Docker es `bbq`.
