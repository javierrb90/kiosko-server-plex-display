# Changelog

## 7.3.1

- La ficha de actividad adopta una geometría fija: carátula siempre visible, panel derecho desplazable y acciones persistentes en el pie del modal.
- Corregida la escala tipográfica de formularios y subvistas.
- Nueva sección Notificaciones en Opciones para decidir qué eventos de Plex y Playnite se almacenan.
- El centro de notificaciones muestra actividades con carátula, título, resumen común y fecha relativa; conserva un máximo de 25 entradas.
- El toast inferior representa exclusivamente la última notificación y permite abrir su actividad o marcarla como leída al cerrarlo.


## 7.3.0

- Nueva terminología de producto: Actividades y Listas.
- Títulos de página contextuales.
- Edición persistente dentro de la ficha.
- Navegación de subvistas sin solapes.



## 7.2.4

- Tautulli puede establecer `subtype` directamente desde el payload, por ejemplo usando `{library_name}`.
- La Actividades muestra simultáneamente la botonera de ubicación y la botonera de tipos.
- El indicador de filtros activos incluye ahora los tipos ocultos en cualquier espacio.

## 7.2.3

- El cambio manual de Subtipo se valida también cuando el actividad ya está en On Deck; se bloquea si rompería el límite de tres por categoría efectiva.
- Contexto, Detalle y Subtipo se presentan como una única cadena compacta: `Contexto · Detalle · Subtipo`.
- Las tarjetas Simple y Normal muestran los listas manuales y dinámicos como píldoras pulsables que aplican el filtro del lista.
- Backlog, On Deck y Colección incorporan una botonera rápida por tipos, independiente para cada espacio durante la sesión.
- Actividades conserva su botonera específica de ubicación.

## 7.2.2

- Corregido el límite de On Deck para que use siempre el Subtipo vigente en SQLite y haga fallback al Tipo solo cuando el Subtipo esté vacío.
- El modal de cupo muestra únicamente los items que comparten la misma categoría efectiva.
- La vista Lista integra Subtipo, Contexto y Detalle bajo el título y elimina sus columnas redundantes.
- Fecha se divide en Último movimiento y Finalización.
- Rating se representa mediante estrellas.

## 7.2.1

- Simplificado el creador de listas dinámicos: las reglas automáticas se basan exclusivamente en Subtipo.
- El valor dinámico solo aparece en los modos Dinámico y Mixto.
- Añadidas explicaciones contextuales para Manual, Dinámico y Mixto.
- El botón Crear lista tiene ahora jerarquía visual de acción primaria.
- Mejorados el resumen y la legibilidad de los listas existentes.

## 7.2.0

- Modelo común reducido para integraciones.
- Subtipo, contexto y detalle opcionales.
- Subtipo manual disponible en ficha, tarjetas, lista y listas dinámicos.
- Cupo de On Deck por subtipo con fallback al tipo.
- Migración SQLite v2.
- API, integraciones y documentación actualizadas.

## 7.1.4

- Tautulli usa el tipo resuelto por Plex como fuente de verdad para distinguir películas, series, temporadas y episodios.
- Los episodios recién añadidos actualizan la entidad de su serie, su actividad y su detalle visible.
- Las opciones de notificación, toast y retirada de Achicharrado permanecen desacopladas de la ingestión.
- La ficha del item incorpora una vista de depuración con el JSON completo y opción de copia.
- Se añaden trazas compactas de resolución Tautulli/Plex para diagnóstico.

## 7.1.3

- La segmentación rápida de Actividades se muestra antes del botón de filtros.
- Botones de segmento más compactos para reducir el ancho de la cabecera.
- Los contadores se calculan tras la primera carga de datos y ya no aparecen a cero al refrescar.

## 7.1.2

- Añadida segmentación rápida exclusiva de Actividades: Sin organizar, Backlog, On Deck y Colección.
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

## 7.1.5

- Laboratorio de debug para notificaciones, Plex/Tautulli y Playnite.
- Historial exclusivo de pruebas, borrable desde Opciones.
- Corrección autoritativa de películas Plex almacenadas históricamente como series.
- Documentación de pruebas simples y reutilización de identificadores.
