# Backups y restauración

La biblioteca y la configuración se exportan por separado.

- **Biblioteca:** items, relaciones, actividad, diario y referencias de assets.
- **Configuración:** apariencia, espacios, integraciones y preferencias.

Los backups completos deben incluir los binarios de `data/assets` como archivos, nunca como Base64 dentro de SQLite o de un JSON masivo. Antes de una importación destructiva se recomienda conservar una copia del volumen `data`.
