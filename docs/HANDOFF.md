# Handoff del proyecto

## Estado de esta milestone

La milestone 7.1 consolida la primera etapa SQLite de BBQ. La aplicación funciona como instalación local con biblioteca en SQLite, assets externos comprimidos, API de ingestión, integración con Plex/Tautulli y Playnite, backups separados y feedback visual de los principales movimientos.

## Decisiones que no deben revertirse accidentalmente

1. **Colección** es el espacio de contenido terminado; **Grupo** es otra entidad.
2. Los cuatro espacios son fijos para el usuario.
3. `canonicalId` es la identidad de dominio; `items.id` es un UUID interno.
4. Ninguna imagen debe persistirse en SQLite como Base64 o BLOB.
5. Playnite debe usar `/api/v1/events`; Tautulli usa `/webhook/tautulli` para que BBQ consulte Plex.
6. Toast, notificación persistente y actualización de datos son efectos independientes.
7. Dar la vuelta solo aparece en Backlog y On Deck.
8. El giro fiable anima el nodo real antes de hacer la petición. No usar clones flotantes para este efecto.
9. Los backups son el contrato de portabilidad entre motores y versiones mayores.

## Últimos problemas resueltos

- colisiones de `items.id` durante sincronizaciones históricas;
- aliases Plex de película/serie con el mismo `ratingKey`;
- toast desactualizado respecto al estado real del último ítem;
- assets de Playnite guardados como Data URI;
- carga local de `canvas-confetti` desde npm;
- doble pase visual en colocación e iluminación;
- botón Dar la vuelta visible por error fuera de Backlog y On Deck.

## Próximos trabajos recomendados

1. Dividir `server.js` en routers: biblioteca, configuración, backups, integraciones y legacy.
2. Crear repositorios explícitos para diario, grupos y configuración; decidir qué migra finalmente a SQLite.
3. Limpiar `style.css`, eliminando reglas versionadas y agrupando estilos por componente.
4. Añadir pruebas automatizadas de identidad, movimientos y backups.
5. Añadir una herramienta manual de diagnóstico de integraciones y assets.
6. Revisar las rutas legacy y documentar una estrategia de deprecación.
7. Medir tamaño de payloads WebSocket: los logs históricos mostraron snapshots de varios MB.

## Archivos de entrada para continuar

- lógica principal: `server.js`
- repositorio SQLite: `src/item-registry-store.js`
- ingestión: `src/services/ingestion-contract.js`
- assets: `src/asset-service.js`
- vista común: `public/views/item-segment-view.js`
- render de tarjetas: `public/core/item-renderer.js`
- ficha: `public/core/item-detail.js`
- estilos: `public/style.css`

## Comprobación rápida

```bash
npm ci
npm run check
npm start
```

Después abrir `/api/health`, cargar la interfaz y ejecutar el recorrido Base de datos → Backlog → On Deck → Colección.

## Debug operativo desde v7.1.5

La ficha de cada ítem expone su JSON mediante el botón `{ }`. Además, Datos y diagnóstico contiene simuladores para notificaciones, Plex/Tautulli y Playnite. Para reproducir un problema, reutiliza el identificador externo mostrado en el JSON; si se omite, se crea una entidad de prueba nueva. El historial del laboratorio es independiente de la actividad real y se puede borrar.
