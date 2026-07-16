
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
  return Array.isArray(group.manualItemIds) && group.manualItemIds.includes(item.id);
}
function groupsMarkup(item = {}, context = '', collectionGroups = []) {
  if (context !== 'collections' || !collectionGroups.length) return '';
  return `<div class="item-detail__groups"><span>Grupos</span><div>${collectionGroups.map(group => {
    const active = itemInGroup(item, group);
    return `<button type="button" data-item-group="${escapeAttr(group.id)}" class="${active ? 'is-active' : ''}">${escapeHtml(group.name)}</button>`;
  }).join('')}</div></div>`;
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
    await api(`/api/backlog/${item.source}/${item.id}/complete`, { method: 'POST', body: JSON.stringify({ rating }) });
    toast(item.source === 'plex' ? 'Marcado como visto' : 'Marcado como terminado');
    return { context: 'collections', status: 'Colecciones' };
  }
  if (context === 'on-deck') {
    await api(`/api/on-deck/${item.id}/complete`, { method: 'POST', body: JSON.stringify({ rating }) });
    toast('Movido a Colecciones');
    return { context: 'collections', status: 'Colecciones' };
  }
  if (context === 'collections') {
    await api(`/api/completions/${item.id}`, { method: 'PATCH', body: JSON.stringify({ rating }) });
    toast('Valoración actualizada');
    return { context: 'collections', status: 'Colecciones' };
  }
  if (context === 'current') {
    await api('/api/current/complete', { method: 'POST', body: JSON.stringify({ rating }) });
    toast(item.source === 'plex' ? 'Marcado como visto' : 'Marcado como terminado');
    return { context: 'collections', status: 'Colecciones' };
  }
  return false;
}

export async function openItemDetail({ ui, api, item, context, toast = () => {}, labels = {}, collectionGroups = [] }) {
  if (!item) return null;
  let currentContext = context;

  function updateModalState(root, nextContext = currentContext) {
    const status = root.querySelector('.item-detail__status');
    if (status) status.textContent = statusLabel(nextContext, item);

    const stars = root.querySelectorAll('[data-item-rate]');
    stars.forEach(button => {
      const n = Number(button.dataset.itemRate || 0);
      button.textContent = n <= Number(item.rating || 0) ? '★' : '☆';
    });

    root.querySelectorAll('[data-hide-after-active]').forEach(node => { node.hidden = true; node.disabled = true; });
  }

  const actions = [];

  if (context === 'backlog') {
    actions.push({
      label: 'Añadir a On Deck',
      variant: 'primary',
      onClick: async root => {
        await api(`/api/backlog/${item.source}/${item.id}/deck`, { method: 'POST' });
        toast('Añadido a On Deck');
        currentContext = 'on-deck';
        updateModalState(root, currentContext);
        return false;
      }
    });
    actions.push({
      label: 'Eliminar del Backlog',
      variant: 'danger',
      onClick: async root => {
        const ok = await ui.confirm({ title: 'Eliminar del Backlog', message: '¿Quitar este elemento del backlog?', confirmText: 'Eliminar', danger: true });
        if (!ok) return false;
        await api(`/api/backlog/${item.source}/${item.id}`, { method: 'DELETE' });
        toast('Elemento eliminado');
        currentContext = 'removed';
        const status = root.querySelector('.item-detail__status');
        if (status) status.textContent = 'Eliminado';
        return false;
      }
    });
  }

  if (context === 'on-deck') {
    actions.push({
      label: 'Devolver al Backlog',
      onClick: async root => {
        await api(`/api/on-deck/${item.id}/backlog`, { method: 'POST' });
        toast('Devuelto al Backlog');
        currentContext = 'backlog';
        updateModalState(root, currentContext);
        return false;
      }
    });
    actions.push({
      label: 'Quitar de On Deck',
      variant: 'danger',
      onClick: async root => {
        const ok = await ui.confirm({ title: 'Quitar de On Deck', message: '¿Quitar este elemento de On Deck?', confirmText: 'Quitar' });
        if (!ok) return false;
        await api(`/api/on-deck/${item.id}`, { method: 'DELETE' });
        toast('Quitado de On Deck');
        currentContext = 'removed';
        const status = root.querySelector('.item-detail__status');
        if (status) status.textContent = 'Eliminado';
        return false;
      }
    });
  }

  if (context === 'collections') {
    actions.push({
      label: 'Eliminar de Colecciones',
      variant: 'danger',
      onClick: async root => {
        const ok = await ui.confirm({ title: 'Eliminar de Colecciones', message: '¿Eliminar este elemento de Colecciones?', confirmText: 'Eliminar', danger: true });
        if (!ok) return false;
        await api(`/api/completions/${item.id}`, { method: 'DELETE' });
        toast('Eliminado de Colecciones');
        currentContext = 'removed';
        const status = root.querySelector('.item-detail__status');
        if (status) status.textContent = 'Eliminado';
        return false;
      }
    });
  }

  if (context === 'current') {
    actions.push({
      label: 'Añadir a On Deck',
      variant: 'primary',
      onClick: async root => {
        await api('/api/current/deck', { method: 'POST' });
        toast('Añadido a On Deck');
        currentContext = 'on-deck';
        updateModalState(root, currentContext);
        return false;
      }
    });
  }

  return new Promise(resolve => {
    ui.open({
      title: labels.title || '',
      className: 'ui-modal-root--item-detail',
      body: bodyMarkup(item, context, collectionGroups),
      actions
    }).then(resolve);

    requestAnimationFrame(() => {
      const root = document.querySelector('.ui-modal-root--item-detail');
      if (!root) return;
      root.querySelectorAll('[data-item-rate]').forEach(button => {
        button.addEventListener('click', async () => {
          const rating = Number(button.dataset.itemRate || 0);
          const result = await applyRating({ api, item, context: currentContext, rating, toast });
          if (result) {
            currentContext = result.context || 'collections';
            updateModalState(root, currentContext);
          }
        });
      });
      root.querySelectorAll('[data-item-group]').forEach(button => {
        button.addEventListener('click', async () => {
          const groupId = button.dataset.itemGroup;
          if (!groupId || !item.id) return;
          if (button.classList.contains('is-active')) {
            await api(`/api/collection-groups/${encodeURIComponent(groupId)}/items/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
            button.classList.remove('is-active');
            toast('Quitado del grupo');
          } else {
            await api(`/api/collection-groups/${encodeURIComponent(groupId)}/items`, { method: 'POST', body: JSON.stringify({ itemId: item.id }) });
            button.classList.add('is-active');
            toast('Añadido al grupo');
          }
        });
      });
    });
  });
}

