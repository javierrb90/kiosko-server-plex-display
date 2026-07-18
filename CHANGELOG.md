# Changelog

## 7.1.1

- Corregida la caché de imágenes Plex para series, temporadas y episodios, incluyendo assets de la serie principal.
- Unificada la canalización de carátulas y fondos de Plex; todas se redimensionan, comprimen y guardan en `data/assets/plex`.
- Evitada la descarga duplicada cuando varios campos Plex apuntan a la misma imagen.
- Docker usa ahora el bind `/var/mnt/nas/MHDisk/bbq:/app/data`.
- Servicio, contenedor y hostname Docker renombrados a `bbq`.

## 7.0.0

- SQLite se convirtió en la fuente de verdad de la biblioteca para instalaciones nuevas.
- Los backups de Biblioteca y Configuración pasaron a ser el flujo oficial entre versiones mayores.
