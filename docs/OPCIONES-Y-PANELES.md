# Opciones, espacios y filtros

BBQueue separa tres niveles de configuración.

## Engranaje: opciones globales
- **General:** vista inicial y notificaciones.
- **Apariencia:** tema, fondos, tarjetas, ficha del item y CSS.
- **Biblioteca:** tipos personalizados y grupos.
- **Espacios de trabajo:** presentación y organización predeterminadas de los cuatro espacios fijos.
- **Parrilla:** activación y límites temporales por tipo y espacio.
- **Integraciones:** conexión y efectos de Plex/Tautulli, Playnite y futuras integraciones, incluida su relación con Achicharrado.
- **Datos y diagnóstico:** backups, mantenimiento y pruebas.

## Lápiz: configuración persistente del espacio
Edita exclusivamente Presentación y Organización. Escribe sobre el mismo objeto de configuración que la sección Espacios de trabajo.

## Embudo: filtros temporales
Filtra por tipos, grupos o estado de parrilla. No guarda reglas permanentes del espacio.

## Controles visuales
- Los valores continuos muestran slider y valor numérico sincronizados.
- Los radios usan presets visuales y permiten un valor exacto en píxeles.
- Las elecciones discretas usan tarjetas o controles segmentados.
- Todos los paneles usan cabecera, navegación por anclas, un único scroll y pie fijo.


## v6.13.1 · Jerarquía de controles

- La navegación principal separa **Base de datos** de la botonera de espacios fijos (**Backlog**, **On Deck** y **Colección**).
- La cabecera global conserva búsqueda, filtro global de achicharrados y Opciones.
- La cabecera de cada espacio contiene filtros de grupos, cambio Grid/Lista y edición persistente del espacio.
- Los tipos visibles son una propiedad persistente del espacio de trabajo, no un filtro temporal.
- Los filtros temporales se limitan a grupos; sus píldoras pueden eliminarse individualmente con la `×`.
- El botón de filtros queda resaltado mientras exista al menos un grupo activo.

## Actualización del detalle de Plex

Los episodios de Plex se consolidan en la entidad de serie, pero conservan como detalle la última actividad recibida (episodio y sufijo `añadido`, `reproducido` o `terminado`). Mover la serie a Backlog u On Deck no sustituye ese detalle por la palabra «Serie», y las actividades posteriores actualizan tanto el registro principal como las copias de seguimiento.
