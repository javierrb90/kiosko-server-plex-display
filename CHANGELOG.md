# Changelog

## 7.0.18

- Todas las animaciones de confirmación duran 300 ms.
- Agrupación por periodos recientes, mes y año.
- Las agrupaciones de fecha pueden usar última actividad o finalización.
- Todos los encabezados de agrupación muestran el número de items.
- Retirado el saneamiento automático de assets antiguos al arrancar.

## 7.0.17

- Las imágenes recibidas por la API se comprimen y guardan como archivos en `data/assets`.
- SQLite conserva rutas de assets, no Data URI ni imágenes codificadas.
- El feedback visual normal se aplica sobre los nodos reales.

## 7.0.16

- “Dar la vuelta” anima la tarjeta real antes de actualizar el servidor.
- Eliminadas las copias visuales del giro manual.

## 7.0.0

- SQLite es la fuente de verdad de la biblioteca en instalaciones nuevas.
- Los assets permanecen en el sistema de archivos.
- La configuración se mantiene separada de la biblioteca.
- Los backups de Biblioteca y Configuración son el flujo oficial entre versiones mayores.
