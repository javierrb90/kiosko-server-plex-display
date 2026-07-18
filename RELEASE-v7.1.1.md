# BBQ v7.1.1

Versión de mantenimiento de la milestone SQLite.

## Cambios

- Todas las imágenes procesadas desde Plex pasan por la caché local, incluidas las carátulas y fondos de series, temporadas y episodios.
- Los assets de la serie principal ya no quedan como URLs remotas al consolidar episodios en su entidad de serie.
- Las imágenes se almacenan comprimidas bajo `data/assets/plex`; SQLite conserva únicamente rutas.
- El compose usa un bind desde `/var/mnt/nas/MHDisk/bbq` hacia `/app/data`.
- El hostname de red y el nombre del contenedor son `bbq`.
