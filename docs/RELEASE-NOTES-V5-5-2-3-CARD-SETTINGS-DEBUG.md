# v5.5.2.3 · Debug de opciones de tarjetas

- Reescrito el bloque Diseño > Tarjetas para evitar duplicados heredados.
- Añadidas trazas en consola con prefijo `[Kiosko Settings]`.
- El servidor registra el patch recibido y el resultado persistido.
- Se desregistra temporalmente el service worker al cargar para evitar caché antigua durante esta fase.
- Las trazas muestran:
  - valores leídos en el modal;
  - número de controles duplicados encontrados;
  - payload enviado;
  - settings devueltos por backend;
  - variables CSS aplicadas.
