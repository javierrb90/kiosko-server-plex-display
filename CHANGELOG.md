# Changelog

## 7.1.4

- Tautulli usa el tipo resuelto por Plex como fuente de verdad para distinguir películas, series, temporadas y episodios.
- Los episodios recién añadidos actualizan la entidad de su serie, su actividad y su detalle visible.
- Las opciones de notificación, toast y retirada de Achicharrado permanecen desacopladas de la ingestión.
- La ficha del item incorpora una vista de depuración con el JSON completo y opción de copia.
- Se añaden trazas compactas de resolución Tautulli/Plex para diagnóstico.

## 7.1.3

- La segmentación rápida de Base de datos se muestra antes del botón de filtros.
- Botones de segmento más compactos para reducir el ancho de la cabecera.
- Los contadores se calculan tras la primera carga de datos y ya no aparecen a cero al refrescar.

## 7.1.2

- Añadida segmentación rápida exclusiva de Base de datos: Sin organizar, Backlog, On Deck y Colección.
- Los segmentos se pueden encender y apagar; siempre queda al menos uno activo.
- Corregida la identidad equivalente de Plex al retirar elementos de Backlog u On Deck.
- Backlog y On Deck pasan a ser mutuamente excluyentes también para aliases históricos de Plex.
- La sincronización del registro resuelve la pertenencia por identidad estable y da prioridad a Colección, después On Deck y después Backlog.

## 7.1.1

- Corregida la caché de imágenes Plex para series, temporadas y episodios, incluyendo assets de la serie principal.
- Unificada la canalización de carátulas y fondos de Plex; todas se redimensionan, comprimen y guardan en `data/assets/plex`.
- Evitada la descarga duplicada cuando varios campos Plex apuntan a la misma imagen.
- Docker usa ahora el bind `/var/mnt/nas/MHDisk/bbq:/app/data`.
- Servicio, contenedor y hostname Docker renombrados a `bbq`.

## 7.0.0

- SQLite se convirtió en la fuente de verdad de la biblioteca para instalaciones nuevas.
- Los backups de Biblioteca y Configuración pasaron a ser el flujo oficial entre versiones mayores.
