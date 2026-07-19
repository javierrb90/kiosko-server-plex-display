# BBQ v7.4.0 — Consolidación de actividades y notificaciones

Esta versión cierra la fase iniciada con SQLite y la nueva terminología del producto.

## Cambios visibles

- La ficha de actividad recupera una altura contenida y predecible.
- La carátula permanece visible y centrada; el panel de información es el área desplazable.
- Las acciones de formularios se muestran en el pie fijo del modal.
- El centro de notificaciones representa actividades y conserva hasta 25 entradas.
- El toast representa solo la notificación más reciente y desaparece al leerla, cerrarla o abrir el panel.
- Al abrir una notificación se navega al espacio real de la actividad antes de abrir su ficha.
- Los recursos CSS y JavaScript usan versión explícita para evitar estilos antiguos tras actualizar.

## Compatibilidad

Los nombres técnicos heredados (`item`, `group`, `database`, `list`) se mantienen en API, SQLite y código donde cambiarlos rompería compatibilidad. En la interfaz se usan Actividad, Lista, Actividades y Tabla.
