# v6.5.4 · Database visibility hotfix

Corrige la vista Base de datos.

## Problema

`/api/items?sync=1` devolvía items correctamente, por lo que backend e Item Registry funcionaban. El fallo estaba en frontend: la vista `database` no marcaba su sección DOM como activa.

Las demás vistas hacían:

```js
el.classList.add('view--active')
el.setAttribute('aria-hidden', 'false')
```

pero `public/views/database.js` no lo hacía. Por eso podía cargar datos y controles internamente, pero la sección seguía oculta.

## Corregido

- `database.show()` añade `view--active`, quita `view--render-hidden` y pone `aria-hidden=false`.
- `database.activate()` hace lo mismo.
- `database.hide()` limpia clase activa y restaura `aria-hidden=true`.
- El contenedor de Base de datos aplica correctamente `media-grid--list` cuando se cambia a Lista.
- Service Worker: `kiosko-v6-5-4`.
