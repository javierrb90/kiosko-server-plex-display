# BBQ v7.2.4

- El webhook de Tautulli acepta `subtype` y lo entrega al contrato común de ingestión.
- Un `subtype` con texto actualiza el ítem; si se omite o llega vacío, conserva el valor existente.
- El payload de depuración conserva el subtipo recibido para facilitar diagnósticos.
- Base de datos incorpora también la botonera rápida de tipos, junto a la segmentación por ubicación.
- Los filtros rápidos de tipo y ubicación se combinan entre sí y con grupos y búsqueda.
