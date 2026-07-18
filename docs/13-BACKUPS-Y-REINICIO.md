# Backups, importación y reinicio

BBQueue 6.15 separa los datos en dos contratos estables, independientes del motor de persistencia.

## Biblioteca

Formato: `bbqueue-library-backup`, versión 1.

Incluye ítems, identificadores externos, pertenencia a espacios, grupos, actividad, estados de parrilla, calificaciones, completados, entradas de diario, reseñas y assets locales. Los assets se incorporan en Base64 con SHA-256 para verificar su integridad.

La importación admite:

- **Reemplazar**: sustituye la biblioteca y los assets actuales.
- **Fusionar**: combina por `canonicalId` o `id`; el backup prevalece en conflictos.

## Configuración

Formato: `bbqueue-settings-backup`, versión 1.

Incluye preferencias generales, apariencia, CSS, espacios, parrilla e integraciones. Tokens y credenciales se omiten salvo que se active expresamente «Incluir credenciales y tokens».

## Reinicio

- Borrar biblioteca: conserva configuración y notificaciones.
- Restablecer configuración: conserva la biblioteca.
- Restablecer todo: elimina biblioteca, assets, notificaciones, estado temporal, CSS y preferencias.

Las acciones destructivas exigen escribir una frase exacta. Se recomienda exportar ambos backups y comprobar que los archivos se pueden abrir antes de reiniciar.

## API

- `GET /api/backups/library?assets=1`
- `POST /api/backups/library/import` con `{ backup, mode }`
- `GET /api/backups/settings?secrets=0`
- `POST /api/backups/settings/import` con `{ backup }`
- `POST /api/reset/library`
- `POST /api/reset/settings`
- `POST /api/reset/all`
