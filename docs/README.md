# Documentación de BBQ

Esta documentación describe el producto, el dominio y la implementación actual. Está pensada tanto para mantenimiento humano como para transferir el proyecto a otra IA sin depender del historial del chat.

## Lectura recomendada

1. [Concepto y objetivos](PROJECT.md)
2. [Modelo de dominio](DOMAIN.md)
3. [Arquitectura técnica](ARCHITECTURE.md)
4. [Persistencia y assets](PERSISTENCE.md)
5. [API HTTP y tiempo real](API.md)
6. [Integraciones](INTEGRATIONS.md)
7. [Interfaz y flujos](FRONTEND.md)
8. [Backups y recuperación](BACKUPS.md)
9. [Desarrollo y despliegue](DEVELOPMENT.md)
10. [Handoff para continuar el proyecto](HANDOFF.md)

## Terminología oficial

- **BBQ**: nombre visible de la aplicación.
- **Actividad**: entidad de contenido gestionada por BBQ.
- **Actividades**: catálogo completo.
- **Backlog**: pendiente no prioritario.
- **On Deck**: pendiente prioritario o activo.
- **Colección**: contenido terminado. Siempre singular en la interfaz y documentación.
- **Lista**: etiqueta o agrupación creada por el usuario. No es una Colección.
- **Parrilla**: sistema temporal que marca contenido Quemándose o Achicharrado.
- **Dar la vuelta**: actualizar la actividad de un actividad a ahora.
