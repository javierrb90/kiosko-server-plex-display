
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
function text(value) { return Array.isArray(value) ? value.filter(Boolean).join(' · ') : (value ? String(value) : ''); }

function typeLabel(item = {}) {
  if (item.collectionType === 'games' || item.source === 'playnite' || item.kind === 'game') return 'Juego';
  if (item.collectionType === 'movies') return 'Película';
  if (item.collectionType === 'series') return 'Serie';
  return item.source === 'plex' ? 'Plex' : 'Contenido';
}

function sourceLabel(item = {}) {
  if (item.source === 'playnite' || item.kind === 'game') return 'Playnite';
  if (item.source === 'plex' || item.kind === 'plex') return 'Plex';
  return item.source ? String(item.source) : 'Fuente';
}

function statusLabel(context, item = {}) {
  if (context === 'backlog') return 'Backlog';
  if (context === 'on-deck') return 'On Deck';
  if (context === 'collections') return item.rating ? `Valorado · ${'★'.repeat(Number(item.rating)||0)}${'☆'.repeat(5-(Number(item.rating)||0))}` : 'Colecciones';
  if (context === 'current') return 'Actual';
  return typeLabel(item);
}

function backdropFor(item = {}) {
  return item.backdrop || item.backdropUrl || item.background || item.backgroundAssetPath || item.poster || item.posterUrl || item.cover || '';
}

function posterMarkup(item = {}) {
  const src = item.poster || item.posterUrl || item.cover || item.coverPath || '';
  const initial = escapeHtml((item.title || '?').slice(0, 1));
  return src ? `<img src="${escapeAttr(src)}" alt="">` : `<div class="item-detail__fallback"><span>${initial}</span></div>`;
}

function metadataRows(item = {}) {
  const rows = [];
  const platforms = item.platforms || item.meta?.platforms || [];
  const developers = item.developers || item.meta?.developers || [];
  const publishers = item.publishers || item.meta?.publishers || [];
  const genres = item.genres || item.meta?.genres || [];
  const releaseYear = item.releaseYear || item.year || item.meta?.releaseYear || "";
  const playtime = item.playtime || item.meta?.playtime || null;

  if (releaseYear) rows.push(['Año', releaseYear]);
  if (Array.isArray(platforms) && platforms.length) rows.push(['Plataforma', platforms.join(' · ')]);
  if (Array.isArray(developers) && developers.length) rows.push(['Desarrollador', developers.join(' · ')]);
  if (Array.isArray(publishers) && publishers.length) rows.push(['Publisher', publishers.join(' · ')]);
  if (Array.isArray(genres) && genres.length) rows.push(['Géneros', genres.join(' · ')]);
  if (playtime) rows.push(['Tiempo jugado', String(playtime)]);
  if (item.type && item.source === 'plex') rows.push(['Tipo', item.type]);
  if (item.completedAt) rows.push(['Fecha', new Date(item.completedAt).toLocaleDateString('es-ES')]);
  return rows.filter(([, value]) => Boolean(value));
}

function ratingControlMarkup(item = {}, context = '') {
  const rating = Number(item.rating || 0);
  if (!['backlog', 'on-deck', 'collections', 'current'].includes(context)) return '';
  return `<div class="item-detail__rate">
    <div class="item-detail__stars">${[1,2,3,4,5].map(n => `<button type="button" data-item-rate="${n}" aria-label="${n} estrellas">${n <= rating ? '★' : '☆'}</button>`).join('')}</div>
  </div>`;
}


function itemInGroup(item = {}, group = {}) {
  const keys = [item.id, item.canonicalId, item.gameId, item.ratingKey].filter(Boolean).map(String);
  const ids = Array.isArray(group.manualItemIds) ? group.manualItemIds.map(String) : [];
  const manualKeys = Array.isArray(group.manualItemKeys) ? group.manualItemKeys.map(String) : [];
  return keys.some(key => ids.includes(key) || manualKeys.includes(key));
}
function groupsMarkup(item = {}, context = '', collectionGroups = []) {
  if (context !== 'collections') return '';
  const activeGroups = collectionGroups.filter(group => itemInGroup(item, group));
  return `<div class="item-detail__groups" data-detail-groups><span>Grupos</span><div class="item-detail__group-list">${activeGroups.length ? activeGroups.map(group => `<span class="item-detail__group-chip">${escapeHtml(group.name)}</span>`).join('') : '<small>Sin grupos manuales</small>'}<button type="button" class="item-detail__group-add" data-detail-action="groups" aria-label="Añadir a grupos">+</button></div><div class="item-detail__group-picker" data-detail-group-picker hidden></div></div>`;
}

function detailActionsMarkup(context = '') {
  if (context === 'backlog') {
    return `<div class="item-detail__actions" data-detail-actions><button type="button" class="ui-modal__button ui-modal__button--primary" data-detail-action="deck">Añadir a On Deck</button><button type="button" class="ui-modal__button ui-modal__button--danger" data-detail-action="delete-backlog">Eliminar del Backlog</button></div>`;
  }
  if (context === 'on-deck') {
    return `<div class="item-detail__actions" data-detail-actions><button type="button" class="ui-modal__button" data-detail-action="backlog">Devolver al Backlog</button><button type="button" class="ui-modal__button ui-modal__button--danger" data-detail-action="delete-deck">Quitar de On Deck</button></div>`;
  }
  if (context === 'collections') {
    return `<div class="item-detail__actions" data-detail-actions><button type="button" class="ui-modal__button ui-modal__button--danger" data-detail-action="delete-collection">Eliminar de Colecciones</button></div>`;
  }
  if (context === 'current') {
    return `<div class="item-detail__actions" data-detail-actions><button type="button" class="ui-modal__button ui-modal__button--primary" data-detail-action="deck-current">Añadir a On Deck</button></div>`;
  }
  if (context === 'removed') {
    return `<div class="item-detail__actions" data-detail-actions><span class="settings-help">Este elemento se ha eliminado del contexto actual.</span></div>`;
  }
  return '';
}

function bodyMarkup(item = {}, context = '', collectionGroups = []) {
  const subtitle = item.subtitle || (Array.isArray(item.platforms) ? item.platforms.join(' · ') : typeLabel(item));
  const backdrop = backdropFor(item);
  return `<div class="item-detail ${backdrop ? 'item-detail--has-bg' : ''}">
    ${backdrop ? `<div class="item-detail__backdrop" style="background-image:url('${escapeAttr(backdrop)}')"></div>` : ''}
    <div class="item-detail__poster">${posterMarkup(item)}</div>
    <div class="item-detail__info">
      <div class="item-detail__status-row">
        <span class="deck-pill item-detail__status">${escapeHtml(statusLabel(context, item))}</span>
        <span class="item-detail__type">${escapeHtml(typeLabel(item))}</span>
        <span class="item-detail__source">${escapeHtml(sourceLabel(item))}</span>
      </div>
      <h3>${escapeHtml(item.title || 'Sin título')}</h3>
      ${subtitle ? `<p class="item-detail__subtitle">${escapeHtml(subtitle)}</p>` : ''}
      ${ratingControlMarkup(item, context)}
      ${groupsMarkup(item, context, collectionGroups)}
      <dl class="item-detail__meta">
        ${metadataRows(item).map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}
      </dl>
      ${detailActionsMarkup(context)}
    </div>
  </div>`;
}

export async function askRating(ui, item = {}, { title = null } = {}) {
  return ui.open({
    title: title || (item.source === 'plex' ? 'Marcar como visto' : 'Marcar como terminado'),
    className: 'ui-modal-root--rating',
    body: `<div class="rating-modal"><div class="rating-modal__poster">${posterMarkup(item)}</div><div class="rating-modal__copy"><h3>${escapeHtml(item.title || 'Sin título')}</h3><p>${escapeHtml(item.subtitle || typeLabel(item))}</p><fieldset class="rating-picker" data-value="${Number(item.rating || 0)}">${[1,2,3,4,5].map(n => `<button type="button" data-rating="${n}">${n <= Number(item.rating || 0) ? '★' : '☆'}</button>`).join('')}</fieldset></div></div>`,
    actions: [
      { label: 'Cancelar', value: null },
      { label: 'Confirmar', variant: 'primary', onClick: root => Number(root.querySelector('.rating-picker')?.dataset.value || item.rating || 0) }
    ]
  });
}

async function applyRating({ api, item, context, rating, toast }) {
  if (!rating) return false;
  item.rating = rating;

  if (context === 'backlog') {
    const response = await api(`/api/backlog/${item.source}/${item.id}/complete`, { method: 'POST', body: JSON.stringify({ rating }) });
    toast(item.source === 'plex' ? 'Marcado como visto' : 'Marcado como terminado');
    return { context: 'collections', status: 'Colecciones', completed: response.completed };
  }
  if (context === 'on-deck') {
    const response = await api(`/api/on-deck/${item.id}/complete`, { method: 'POST', body: JSON.stringify({ rating }) });
    toast('Movido a Colecciones');
    return { context: 'collections', status: 'Colecciones', completed: response.completed };
  }
  if (context === 'collections') {
    const response = await api(`/api/completions/${item.id}`, { method: 'PATCH', body: JSON.stringify({ rating }) });
    Object.assign(item, response || {});
    toast('Valoración actualizada');
    return { context: 'collections', status: 'Colecciones', completed: response };
  }
  if (context === 'current') {
    const response = await api('/api/current/complete', { method: 'POST', body: JSON.stringify({ rating }) });
    toast(item.source === 'plex' ? 'Marcado como visto' : 'Marcado como terminado');
    return { context: 'collections', status: 'Colecciones', completed: response.completed };
  }
  return false;
}

export async function openItemDetail({ ui, api, item, context, toast = () => {}, labels = {}, collectionGroups = [] }) {
  if (!item) return null;
  let currentContext = context;
  let busy = false;

  const itemKeys = () => [item.id, item.canonicalId, item.gameId, item.ratingKey].filter(Boolean).map(String);

  const mergeReturnedItem = payload => {
    const next = payload?.completed || payload?.deckItem || payload?.item || payload;
    if (next && typeof next === 'object') Object.assign(item, next);
  };

  const renderBody = root => {
    const body = root.querySelector('.ui-modal__body');
    if (body) body.innerHTML = bodyMarkup(item, currentContext, collectionGroups);
  };

  const refreshGroups = async () => {
    const response = await api('/api/collection-groups').catch(() => null);
    if (response?.groups) collectionGroups = response.groups;
    return collectionGroups;
  };

  function renderInlineGroupPicker(root) {
    const picker = root.querySelector('[data-detail-group-picker]');
    if (!picker) return;
    if (!item.id) {
      picker.hidden = false;
      picker.innerHTML = `<p class="settings-help">Primero hay que guardar el item en Colecciones.</p>`;
      return;
    }
    if (!collectionGroups.length) {
      picker.hidden = false;
      picker.innerHTML = `<p class="settings-help">No hay grupos creados.</p>`;
      return;
    }
    picker.hidden = false;
    picker.innerHTML = `<div class="groups-picker groups-picker--inline">${collectionGroups.map(group => `<label class="controls-modal__toggle"><input type="checkbox" data-group-pick="${escapeAttr(group.id)}" ${itemInGroup(item, group) ? 'checked' : ''}><span>${escapeHtml(group.name)}</span><small>${escapeHtml(group.mode || 'manual')}</small></label>`).join('')}</div><div class="item-detail__group-picker-actions"><button type="button" class="ui-modal__button" data-detail-action="groups-cancel">Cancelar</button><button type="button" class="ui-modal__button ui-modal__button--primary" data-detail-action="groups-save">Guardar grupos</button></div>`;
  }

  async function saveInlineGroups(root) {
    if (!item.id || busy) return;
    busy = true;
    const picker = root.querySelector('[data-detail-group-picker]');
    const selected = new Set([...root.querySelectorAll('[data-group-pick]:checked')].map(input => input.dataset.groupPick));
    const keys = itemKeys();
    for (const group of collectionGroups) {
      const active = itemInGroup(item, group);
      if (selected.has(group.id) && !active) {
        await api(`/api/collection-groups/${encodeURIComponent(group.id)}/items`, { method: 'POST', body: JSON.stringify({ itemId: item.id, itemKeys: keys }) });
      }
      if (!selected.has(group.id) && active) {
        await api(`/api/collection-groups/${encodeURIComponent(group.id)}/items/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
      }
    }
    await refreshGroups();
    busy = false;
    toast('Grupos actualizados');
    window.dispatchEvent(new CustomEvent('kiosko:collection-groups-changed'));
    renderBody(root);
  }

  async function runAction(root, action) {
    if (!action || busy) return;

    if (action === 'groups') {
      await refreshGroups();
      renderInlineGroupPicker(root);
      return;
    }

    if (action === 'groups-cancel') {
      const picker = root.querySelector('[data-detail-group-picker]');
      if (picker) { picker.hidden = true; picker.innerHTML = ''; }
      return;
    }

    if (action === 'groups-save') {
      await saveInlineGroups(root);
      return;
    }

    busy = true;
    try {
      if (action === 'deck' && currentContext === 'backlog') {
        const response = await api(`/api/backlog/${item.source}/${item.id}/deck`, { method: 'POST' });
        mergeReturnedItem(response);
        currentContext = 'on-deck';
        toast('Añadido a On Deck');
        renderBody(root);
        return;
      }

      if (action === 'deck-current' && currentContext === 'current') {
        const response = await api('/api/current/deck', { method: 'POST' });
        mergeReturnedItem(response);
        currentContext = 'on-deck';
        toast('Añadido a On Deck');
        renderBody(root);
        return;
      }

      if (action === 'backlog' && currentContext === 'on-deck') {
        const response = await api(`/api/on-deck/${item.id}/backlog`, { method: 'POST' });
        mergeReturnedItem(response);
        currentContext = 'backlog';
        toast('Devuelto al Backlog');
        renderBody(root);
        return;
      }

      if (action === 'delete-backlog' && currentContext === 'backlog') {
        const ok = await ui.confirm({ title: 'Eliminar del Backlog', message: '¿Quitar este elemento del backlog?', confirmText: 'Eliminar', danger: true });
        if (!ok) return;
        await api(`/api/backlog/${item.source}/${item.id}`, { method: 'DELETE' });
        currentContext = 'removed';
        toast('Elemento eliminado');
        renderBody(root);
        return;
      }

      if (action === 'delete-deck' && currentContext === 'on-deck') {
        const ok = await ui.confirm({ title: 'Quitar de On Deck', message: '¿Quitar este elemento de On Deck?', confirmText: 'Quitar' });
        if (!ok) return;
        await api(`/api/on-deck/${item.id}`, { method: 'DELETE' });
        currentContext = 'removed';
        toast('Quitado de On Deck');
        renderBody(root);
        return;
      }

      if (action === 'delete-collection' && currentContext === 'collections') {
        const ok = await ui.confirm({ title: 'Eliminar de Colecciones', message: '¿Eliminar este elemento de Colecciones?', confirmText: 'Eliminar', danger: true });
        if (!ok) return;
        await api(`/api/completions/${item.id}`, { method: 'DELETE' });
        currentContext = 'removed';
        toast('Eliminado de Colecciones');
        renderBody(root);
      }
    } finally {
      busy = false;
    }
  }

  return new Promise(resolve => {
    ui.open({
      title: labels.title || '',
      className: 'ui-modal-root--item-detail',
      body: bodyMarkup(item, currentContext, collectionGroups),
      actions: []
    }).then(resolve);

    requestAnimationFrame(() => {
      const root = document.querySelector('.ui-modal-root--item-detail');
      if (!root) return;

      if (root.__itemDetailAbort) root.__itemDetailAbort.abort();
      root.__itemDetailAbort = new AbortController();

      root.addEventListener('click', async event => {
        const rateButton = event.target.closest('[data-item-rate]');
        if (rateButton) {
          if (busy) return;
          busy = true;
          try {
            const rating = Number(rateButton.dataset.itemRate || 0);
            const result = await applyRating({ api, item, context: currentContext, rating, toast });
            if (result) {
              if (result.completed) mergeReturnedItem(result);
              currentContext = result.context || 'collections';
              window.dispatchEvent(new CustomEvent('kiosko:collections-changed'));
              renderBody(root);
            }
          } finally {
            busy = false;
          }
          return;
        }

        const actionButton = event.target.closest('[data-detail-action]');
        if (actionButton) {
          await runAction(root, actionButton.dataset.detailAction);
        }
      }, { signal: root.__itemDetailAbort.signal });
    });
  });
}

