# Concepto y objetivos

## Qué es BBQ

BBQ es un gestor local de biblioteca personal orientado a la toma de decisiones. Puede recibir contenido manualmente o desde aplicaciones externas, conservar su metadata y ayudar a moverlo por un flujo simple: descubrir, posponer, priorizar y terminar.

No pretende sustituir a Plex, Playnite o los gestores ARR. Es una capa transversal que unifica actividad y organización entre plataformas.

## Objetivos

- Mantener una identidad estable para cada actividad aunque llegue desde distintas vistas o integraciones.
- Representar con claridad dónde está cada actividad dentro del flujo personal.
- Reducir el contenido abandonado mediante la parrilla y la actividad.
- Permitir una ingestión externa genérica y extensible.
- Seguir siendo local, portable y operable con un único volumen persistente.
- Separar datos estructurados, configuración y assets binarios.
- Ofrecer backups independientes de Biblioteca y Configuración.

## Fuera de alcance actual

- Multiusuario con permisos por cuenta.
- Sincronización distribuida entre varias instancias.
- Escalado horizontal de la base de datos.
- Edición de las reglas estructurales de los cuatro espacios desde la interfaz.

## Principios de producto

1. Una acción que mueve un actividad debe seguirlo al espacio de destino.
2. Los filtros temporales nunca deben confundirse con configuración persistente.
3. Una integración actualiza datos y actividad; las notificaciones y los toast son efectos separados.
4. El usuario debe poder exportar sus datos sin depender del motor interno.
5. La interfaz debe explicar los cambios mediante feedback visual discreto y coherente.
