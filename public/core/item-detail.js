function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
function text(value) { return Array.isArray(value) ? value.filter(Boolean).join(' · ') : (value ? String(value) : ''); }

function typeFor(item = {}) {
  if (item.collectionType === 'games' || item.source === 'playnite' || item.kind === 'game') return 'games';
  if (item.collectionType === 'movies') return 'movies';
  return 'series';
}
function typeLabel(item = {}) { return typeFor(item) === 'games' ? 'Juego' : typeFor(item) === 'movies' ? 'Película' : 'Serie'; }
function sourceLabel(item = {}) {
  if (item.source === 'playnite' || item.kind === 'game') return 'Playnite';
  if (item.source === 'plex' || item.kind === 'plex') return 'Plex';
  return item.source ? String(item.source) : 'Fuente';
}
function formatDate(value) {
  const date = new Date(value || '');
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
}
function inputDate(value) {
  const date = new Date(value || '');
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : '';
}
function itemDateLine(item = {}) {
  if (item.completedAt) return `<div class="item-detail__date-line" title="Fecha de finalización"><span>✓</span>${escapeHtml(formatDate(item.completedAt))}</div>`;
  if (item.lastActivityAt || item.lastSeenAt) return `<div class="item-detail__date-line" title="Última actividad"><span>↻</span>${escapeHtml(formatDate(item.lastActivityAt || item.lastSeenAt))}</div>`;
  if (item.firstSeenAt) return `<div class="item-detail__date-line" title="Entrada en base de datos"><span>＋</span>${escapeHtml(formatDate(item.firstSeenAt))}</div>`;
  return '';
}
function defaultDetailDesign() { return { background: 'backdrop', shade: 'medium', blur: 'soft' }; }
function readDetailDesign(settings = {}) {
  return { ...defaultDetailDesign(), ...(settings.design?.itemDetail?.background || settings.design?.itemDetail || {}) };
}
function detailDesignClass(settings = {}) {
  const design = readDetailDesign(settings);
  return [`item-detail--bg-${design.background || 'backdrop'}`, `item-detail--shade-${design.shade || 'medium'}`, `item-detail--blur-${design.blur || 'soft'}`].join(' ');
}
function backdropFor(item = {}) { return item.backdrop || item.backdropUrl || item.background || item.backgroundAssetPath || item.poster || item.posterUrl || item.cover || ''; }
function effectiveBackdrop(item = {}, settings = {}) {
  const design = readDetailDesign(settings);
  if (design.background === 'none' || design.background === 'solid') return '';
  if (design.background === 'poster') return item.poster || item.posterUrl || item.cover || backdropFor(item);
  return backdropFor(item);
}
function posterMarkup(item = {}) {
  const src = item.poster || item.posterUrl || item.cover || item.coverPath || '';
  const initial = escapeHtml((item.title || '?').slice(0, 1));
  return src ? `<img src="${escapeAttr(src)}" alt="">` : `<div class="item-detail__fallback"><span>${initial}</span></div>`;
}
function statusLabel(context, item = {}) {
  if (context === 'backlog') return 'Backlog';
  if (context === 'on-deck') return 'On Deck';
  if (context === 'collections') return item.rating ? `Valorado · ${'★'.repeat(Number(item.rating)||0)}${'☆'.repeat(5-(Number(item.rating)||0))}` : 'Colecciones';
  if (context === 'current') return 'Actual';
  if (context === 'database') return 'Base de datos';
  return typeLabel(item);
}
function cleanList(values) {
  return (Array.isArray(values) ? values : [values]).flat().filter(Boolean).map(value => {
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (typeof value === 'object') return value.tag || value.name || value.title || value.label || value.value || '';
    return '';
  }).filter(Boolean);
}
function metaValue(item = {}, key = '') {
  const meta = item.meta || item.metadata || {};
  const map = {
    year: item.releaseYear || item.year || meta.releaseYear,
    platform: cleanList(item.platforms || meta.platforms || item.platform || meta.platform).join(' · '),
    platforms: cleanList(item.platforms || meta.platforms || item.platform || meta.platform).join(' · '),
    developer: cleanList(item.developers || meta.developers || item.developer || meta.developer).join(' · '),
    developers: cleanList(item.developers || meta.developers || item.developer || meta.developer).join(' · '),
    publisher: cleanList(item.publishers || meta.publishers || item.publisher || meta.publisher).join(' · '),
    publishers: cleanList(item.publishers || meta.publishers || item.publisher || meta.publisher).join(' · '),
    genres: cleanList(item.genres || meta.genres || item.genre || meta.genre).join(' · '),
    genre: cleanList(item.genres || meta.genres || item.genre || meta.genre).join(' · '),
    playtime: item.playtime || meta.playtime,
    duration: item.duration || meta.duration,
    studio: item.studio || meta.studio,
    director: item.director || meta.director,
    type: item.type || meta.plexType,
    firstSeenAt: formatDate(item.firstSeenAt),
    lastActivityAt: formatDate(item.lastActivityAt || item.lastSeenAt),
    completedAt: formatDate(item.completedAt),
    latestActivity: meta.createdEpisodeCode || meta.originalSubtitle || meta.createdEpisodeTitle || meta.originalTitle || ''
  };
  if (key.startsWith('meta.')) return text(meta[key.slice(5)]);
  return text(map[key] ?? item[key] ?? meta[key]);
}
const META_LABELS = {
  year: 'Año', platform: 'Plataforma', platforms: 'Plataforma', developer: 'Desarrollador', developers: 'Desarrollador',
  publisher: 'Publisher', publishers: 'Publisher', genres: 'Géneros', genre: 'Géneros', playtime: 'Tiempo jugado', duration: 'Duración',
  studio: 'Studio', director: 'Director', type: 'Tipo', firstSeenAt: 'Entrada en BD', lastActivityAt: 'Última actividad', completedAt: 'Finalización', latestActivity: 'Última novedad'
};
const DEFAULT_METADATA_FIELDS = {
  games: ['year','platforms','developers','publishers','genres','playtime','firstSeenAt','lastActivityAt','completedAt'],
  movies: ['year','genres','duration','studio','director','firstSeenAt','lastActivityAt','completedAt'],
  series: ['year','genres','studio','latestActivity','firstSeenAt','lastActivityAt','completedAt']
};
function metadataFieldsFor(item = {}, settings = {}) {
  const t = typeFor(item);
  const configured = settings.design?.itemDetail?.metadataFields?.[t];
  return Array.isArray(configured) && configured.length ? configured : DEFAULT_METADATA_FIELDS[t];
}
function metadataRows(item = {}, settings = {}) {
  return metadataFieldsFor(item, settings).map(key => [META_LABELS[key] || key.replace(/^meta\./, ''), metaValue(item, key)]).filter(([, value]) => Boolean(value));
}
function ratingControlMarkup(item = {}, context = '') {
  const rating = Number(item.rating || 0);
  if (!['backlog', 'on-deck', 'collections', 'current', 'database'].includes(context)) return '';
  return `<div class="item-detail__rate"><div class="item-detail__stars">${[1,2,3,4,5].map(n => `<button type="button" data-item-rate="${n}" aria-label="${n} estrellas">${n <= rating ? '★' : '☆'}</button>`).join('')}</div></div>`;
}
function isInBacklog(item = {}, context = '') { return context === 'backlog' || item.states?.inBacklog === true; }
function isInDeck(item = {}, context = '') { return context === 'on-deck' || item.states?.inOnDeck === true; }
function isInCollection(item = {}, context = '') { return context === 'collections' || item.states?.completed === true || Boolean(item.rating || item.completedAt); }

function statePillsMarkup(item = {}, context = '') {
  const pills = [];
  pills.push(typeLabel(item));
  pills.push(sourceLabel(item));
  if (isInBacklog(item, context)) pills.push('Backlog');
  if (isInDeck(item, context)) pills.push('On Deck');
  if (isInCollection(item, context)) pills.push(item.rating ? `Calificado · ${Number(item.rating)}/5` : 'Calificado');
  return `<div class="item-detail__state-pills">${pills.map(label => `<span class="deck-pill item-detail__status">${escapeHtml(label)}</span>`).join('')}</div>`;
}

function groupItemKeys(item = {}) {
  const meta = item.meta || {};
  const keys = [item.canonicalId, meta.canonicalId, item.id, item.gameId, meta.gameId, item.ratingKey, meta.ratingKey, meta.relatedSeriesCanonicalId, meta.relatedOnDeckCanonicalId, item.grandparentRatingKey ? `plex:show:${item.grandparentRatingKey}` : null, meta.grandparentRatingKey ? `plex:show:${meta.grandparentRatingKey}` : null, item.parentRatingKey && (item.type === 'episode' || item.type === 'season') ? `plex:show:${item.parentRatingKey}` : null].filter(Boolean).map(String);
  return [...new Set(keys)];
}
function fieldValues(item = {}, field = '') {
  const meta = item.meta || {};
  const asArray = value => Array.isArray(value) ? value : (value ? [value] : []);
  const platformCandidates = [...asArray(item.platforms), ...asArray(meta.platforms), ...asArray(item.platform), ...asArray(meta.platform), item.subtitle];
  const valueMap = { title: [item.title], source: [item.source], type: [item.collectionType, item.type, meta.plexType], year: [item.year, item.releaseYear, meta.releaseYear], platform: platformCandidates, platforms: platformCandidates, genre: [...asArray(item.genres), ...asArray(meta.genres), ...asArray(item.genre), ...asArray(meta.genre)], genres: [...asArray(item.genres), ...asArray(meta.genres), ...asArray(item.genre), ...asArray(meta.genre)], developer: [...asArray(item.developers), ...asArray(meta.developers), ...asArray(item.developer), ...asArray(meta.developer)], publisher: [...asArray(item.publishers), ...asArray(meta.publishers), ...asArray(item.publisher), ...asArray(meta.publisher)] };
  return (valueMap[field] || [item[field], meta[field]]).flat().filter(Boolean).map(value => String(value).toLowerCase());
}
function itemInGroup(item = {}, group = {}) {
  const keys = groupItemKeys(item);
  const ids = Array.isArray(group.manualItemIds) ? group.manualItemIds.map(String) : [];
  const manualKeys = Array.isArray(group.manualItemKeys) ? group.manualItemKeys.map(String) : [];
  if (keys.some(key => ids.includes(key) || manualKeys.includes(key))) return true;
  if (group.mode === 'manual') return false;
  const rules = group.rules || [];
  if (!rules.length) return false;
  const checks = rules.map(rule => {
    const values = fieldValues(item, rule.field);
    const needle = String(rule.value || '').toLowerCase();
    if (!needle) return false;
    return rule.operator === 'equals' ? values.some(value => value === needle) : values.some(value => value.includes(needle));
  });
  return (group.match || 'all') === 'any' ? checks.some(Boolean) : checks.every(Boolean);
}
function groupsMarkup(item = {}, context = '', collectionGroups = []) {
  if (!['backlog', 'on-deck', 'collections', 'current', 'database'].includes(context)) return '';
  const activeGroups = collectionGroups.filter(group => itemInGroup(item, group));
  return `<div class="item-detail__groups item-detail__groups--compact" data-detail-groups><div class="item-detail__groups-head"><span>Grupos</span><button type="button" class="item-detail__group-add" data-detail-action="groups" aria-label="Añadir a grupos">+</button></div>${activeGroups.length ? `<div class="item-detail__group-list">${activeGroups.map(group => `<span class="item-detail__group-chip">${escapeHtml(group.name)}</span>`).join('')}</div>` : ''}<div class="item-detail__group-picker" data-detail-group-picker hidden></div></div>`;
}
function primaryActionsMarkup(item = {}, context = '') {
  const backlog = isInBacklog(item, context);
  const deck = isInDeck(item, context);
  const actions = [];
  if (context !== 'current') actions.push(`<button type="button" class="item-detail__quick item-detail__quick--tracking ${backlog ? 'is-active' : ''}" data-detail-action="toggle-backlog" title="${backlog ? 'Quitar del Backlog' : 'Seguir actividad'}"><span>${backlog ? 'Siguiendo' : 'Seguir'}</span></button>`);
  if (context !== 'on-deck') actions.push(`<button type="button" class="item-detail__quick item-detail__quick--deck ${deck ? 'is-active' : ''}" data-detail-action="toggle-deck" title="${deck ? 'Quitar de On Deck' : 'Añadir a On Deck'}"><span>${deck ? 'En Deck' : 'Deck'}</span></button>`);
  if (context === 'on-deck') actions.push(`<button type="button" class="item-detail__quick item-detail__quick--deck is-active" data-detail-action="toggle-deck" title="Quitar de On Deck"><span>Quitar Deck</span></button>`);
  return actions.join('');
}
function detailActionsMarkup(item = {}, context = '') {
  if (context === 'removed') return `<div class="item-detail__actions item-detail__actions--clean" data-detail-actions><span class="settings-help">Este elemento se ha eliminado del contexto actual.</span></div>`;
  const collectionAction = isInCollection(item, context) ? `<button type="button" data-detail-action="remove-collection">Quitar de Colecciones</button>` : '';
  return `<div class="item-detail__actions item-detail__actions--clean" data-detail-actions>
    <div class="item-detail__quick-group">${primaryActionsMarkup(item, context)}</div>
    <div class="item-detail__more"><button type="button" class="item-detail__quick" data-detail-action="menu" title="Editar y más opciones">✎</button><div class="item-detail__more-menu" data-detail-more-menu hidden><button type="button" data-detail-action="edit">✎ Editar item</button>${collectionAction}<button type="button" class="danger" data-detail-action="delete-permanent">Eliminar definitivamente</button></div></div>
  </div>`;
}
function bodyMarkup(item = {}, context = '', collectionGroups = [], settings = {}) {
  const subtitle = item.subtitle || (Array.isArray(item.platforms) ? item.platforms.join(' · ') : typeLabel(item));
  const backdrop = effectiveBackdrop(item, settings);
  return `<div class="item-detail ${detailDesignClass(settings)} ${backdrop ? 'item-detail--has-bg' : ''}">
    ${backdrop ? `<div class="item-detail__backdrop" style="background-image:url('${escapeAttr(backdrop)}')"></div>` : ''}
    <div class="item-detail__poster">${posterMarkup(item)}</div>
    <div class="item-detail__info">
      <div class="item-detail__status-row">${statePillsMarkup(item, context)}</div>
      <h3>${escapeHtml(item.title || 'Sin título')}</h3>
      ${itemDateLine(item)}
      ${subtitle ? `<p class="item-detail__subtitle">${escapeHtml(subtitle)}</p>` : ''}
      ${ratingControlMarkup(item, context)}
      ${groupsMarkup(item, context, collectionGroups)}
      <dl class="item-detail__meta">${metadataRows(item, settings).map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>
      ${detailActionsMarkup(item, context)}
    </div>
  </div>`;
}
export async function askRating(ui, item = {}, { title = null } = {}) {
  return ui.open({ title: title || (item.source === 'plex' ? 'Marcar como visto' : 'Marcar como terminado'), className: 'ui-modal-root--rating', body: `<div class="rating-modal"><div class="rating-modal__poster">${posterMarkup(item)}</div><div class="rating-modal__copy"><h3>${escapeHtml(item.title || 'Sin título')}</h3><p>${escapeHtml(item.subtitle || typeLabel(item))}</p><fieldset class="rating-picker" data-value="${Number(item.rating || 0)}">${[1,2,3,4,5].map(n => `<button type="button" data-rating="${n}">${n <= Number(item.rating || 0) ? '★' : '☆'}</button>`).join('')}</fieldset></div></div>`, actions: [{ label: 'Cancelar', value: null }, { label: 'Confirmar', variant: 'primary', onClick: root => Number(root.querySelector('.rating-picker')?.dataset.value || item.rating || 0) }] });
}
async function askRemoveFromDeck(ui) {
  return ui.confirm({ title: 'Calificación guardada', message: 'Este item está en On Deck. ¿Quieres retirarlo de On Deck también?', confirmText: 'Retirar de On Deck' });
}
async function applyRating({ ui, api, item, context, rating, toast }) {
  if (!rating) return false;
  const removeFromDeck = isInDeck(item, context) ? await askRemoveFromDeck(ui) : false;
  const canonical = encodeURIComponent(item.canonicalId || item.id);
  let response;
  if (context === 'current') response = await api('/api/current/complete', { method: 'POST', body: JSON.stringify({ rating, removeFromDeck }) });
  else response = await api(`/api/items/${canonical}/complete`, { method: 'POST', body: JSON.stringify({ rating, removeFromDeck, from: context }) });
  Object.assign(item, response.completed || {}, { rating: Number(rating), completedAt: response.completed?.completedAt || item.completedAt, states: { ...(item.states || {}), completed: true, inOnDeck: removeFromDeck ? false : isInDeck(item, context), inBacklog: isInBacklog(item, context) } });
  toast(removeFromDeck ? 'Calificado y retirado de On Deck' : 'Calificación guardada');
  return { context, completed: response.completed };
}

export async function openItemDetail({ ui, api, item, context, toast = () => {}, labels = {}, collectionGroups = [], settings = {} }) {
  if (!item) return null;
  let currentContext = context;
  let busy = false;
  const previousHash = window.location.hash;
  try { if (item.canonicalId) window.history.replaceState(null, '', `#/item/${encodeURIComponent(item.canonicalId)}?from=${encodeURIComponent(context || 'database')}`); } catch {}
  const mergeReturnedItem = payload => { const next = payload?.completed || payload?.deckItem || payload?.item || payload; if (next && typeof next === 'object') Object.assign(item, next); };
  const renderBody = root => { const body = root.querySelector('.ui-modal__body'); if (body) body.innerHTML = bodyMarkup(item, currentContext, collectionGroups, settings); };
  const refreshGroups = async () => { const response = await api('/api/collection-groups').catch(() => null); if (response?.groups) collectionGroups = response.groups; return collectionGroups; };
  function renderInlineGroupPicker(root) { const picker = root.querySelector('[data-detail-group-picker]'); if (!picker) return; const keys = groupItemKeys(item); if (!keys.length) { picker.hidden = false; picker.innerHTML = `<p class="settings-help">No hay una clave estable para este item.</p>`; return; } if (!collectionGroups.length) { picker.hidden = false; picker.innerHTML = `<p class="settings-help">No hay grupos creados.</p>`; return; } picker.hidden = false; picker.innerHTML = `<div class="groups-picker groups-picker--inline">${collectionGroups.map(group => `<label class="controls-modal__toggle"><input type="checkbox" data-group-pick="${escapeAttr(group.id)}" ${itemInGroup(item, group) ? 'checked' : ''}><span>${escapeHtml(group.name)}</span><small>${escapeHtml(group.mode || 'manual')}</small></label>`).join('')}</div><div class="item-detail__group-picker-actions"><button type="button" class="ui-modal__button" data-detail-action="groups-cancel">Cancelar</button><button type="button" class="ui-modal__button ui-modal__button--primary" data-detail-action="groups-save">Guardar grupos</button></div>`; }
  async function saveInlineGroups(root) { if (busy) return; const keys = groupItemKeys(item); const primaryKey = keys[0]; if (!primaryKey) { toast('No hay una clave estable para este item'); return; } busy = true; const selected = new Set([...root.querySelectorAll('[data-group-pick]:checked')].map(input => input.dataset.groupPick)); for (const group of collectionGroups) { const active = itemInGroup(item, group); if (selected.has(group.id) && !active) await api(`/api/collection-groups/${encodeURIComponent(group.id)}/items`, { method: 'POST', body: JSON.stringify({ itemId: primaryKey, itemKeys: keys }) }); if (!selected.has(group.id) && active) await api(`/api/collection-groups/${encodeURIComponent(group.id)}/items/${encodeURIComponent(primaryKey)}`, { method: 'DELETE', body: JSON.stringify({ itemKeys: keys }) }); } await refreshGroups(); busy = false; toast('Grupos actualizados'); window.dispatchEvent(new CustomEvent('kiosko:collection-groups-changed')); renderBody(root); }
  async function chooseDeckReplacement(limitPayload = {}) { const categoryLabel = { games: 'juegos', movies: 'películas', series: 'series' }[limitPayload.category] || 'items'; const cards = (limitPayload.currentItems || []).map(entry => { const img = entry.poster || entry.posterUrl || entry.cover || ''; const initial = escapeHtml((entry.title || '?').slice(0, 1)); return `<label class="deck-replace-card"><input type="radio" name="deck-replace" value="${escapeAttr(entry.id)}"><span class="deck-replace-card__poster">${img ? `<img src="${escapeAttr(img)}" alt="">` : `<span>${initial}</span>`}</span><strong>${escapeHtml(entry.title || 'Sin título')}</strong><small>${escapeHtml(entry.subtitle || '')}</small></label>`; }).join(''); const result = await ui.open({ title: 'Límite de On Deck', className: 'ui-modal-root--wide', body: `<div class="deck-limit-modal"><p>Ya tienes ${limitPayload.limit || 3} ${categoryLabel} en On Deck. Para añadir <strong>${escapeHtml(limitPayload.newItem?.title || item.title || 'este item')}</strong>, elige cuál quieres reemplazar.</p><div class="deck-replace-grid">${cards}</div></div>`, actions: [{ label: 'Cancelar', value: null }, { label: 'Reemplazar seleccionado', variant: 'primary', onClick: root => root.querySelector('input[name="deck-replace"]:checked')?.value || false }] }); return result || null; }
  async function postDeckWithReplacement(path) { try { return await api(path, { method: 'POST' }); } catch (error) { if (error.status !== 409 || error.data?.reason !== 'deck_limit_reached') throw error; const replaceId = await chooseDeckReplacement(error.data); if (!replaceId) return null; return api(path, { method: 'POST', body: JSON.stringify({ replaceId }) }); } }
  async function editItem(root) { const result = await ui.open({ title: 'Editar item', body: `<div class="controls-modal"><section class="controls-modal__section"><h3>Estado / detalle</h3><label class="ui-field"><span>Detalle visible</span><input type="text" data-detail-subtitle value="${escapeAttr(item.subtitle || '')}" placeholder="Última actividad, plataforma, episodio..."></label><p class="settings-help">El detalle resume el estado orgánico del item. Si lo cambias manualmente, también se actualiza la última actividad a hoy.</p></section><section class="controls-modal__section"><h3>Fechas</h3><label class="ui-field"><span>Entrada en base de datos</span><input type="date" data-date-first value="${escapeAttr(inputDate(item.firstSeenAt))}"></label><label class="ui-field"><span>Última actividad</span><input type="date" data-date-activity value="${escapeAttr(inputDate(item.lastActivityAt || item.lastSeenAt))}"></label><label class="ui-field"><span>Finalización</span><input type="date" data-date-completed value="${escapeAttr(inputDate(item.completedAt))}"></label></section></div>`, actions: [{ label: 'Cancelar', value: null }, { label: 'Guardar', variant: 'primary', onClick: modal => ({ subtitle: modal.querySelector('[data-detail-subtitle]')?.value || '', firstSeenAt: modal.querySelector('[data-date-first]')?.value || null, lastActivityAt: modal.querySelector('[data-date-activity]')?.value || null, completedAt: modal.querySelector('[data-date-completed]')?.value || null }) }] }); if (!result) return; const payload = Object.fromEntries(Object.entries(result).map(([key, value]) => [key, key === 'subtitle' ? value : (value ? `${value}T12:00:00.000Z` : null)])); const response = await api(`/api/items/${encodeURIComponent(item.canonicalId)}/dates`, { method: 'PATCH', body: JSON.stringify(payload) }); mergeReturnedItem(response); toast('Item actualizado'); renderBody(root); }
  async function runAction(root, action) {
    if (!action || busy) return;
    if (action === 'groups') { await refreshGroups(); renderInlineGroupPicker(root); return; }
    if (action === 'groups-cancel') { const picker = root.querySelector('[data-detail-group-picker]'); if (picker) { picker.hidden = true; picker.innerHTML = ''; } return; }
    if (action === 'groups-save') { await saveInlineGroups(root); return; }
    if (action === 'menu') { const menu = root.querySelector('[data-detail-more-menu]'); if (menu) menu.hidden = !menu.hidden; return; }
    if (action === 'edit') { await editItem(root); return; }
    busy = true;
    try {
      const canonical = encodeURIComponent(item.canonicalId || item.id);
      if (action === 'toggle-backlog') {
        if (isInBacklog(item, currentContext)) { await api(`/api/items/${canonical}/backlog`, { method: 'DELETE' }); item.states = { ...(item.states || {}), inBacklog: false }; toast('Quitado del Backlog'); }
        else { const response = await api(`/api/items/${canonical}/backlog`, { method: 'POST' }); mergeReturnedItem(response); item.states = { ...(item.states || {}), inBacklog: true }; toast('Siguiendo actividad en Backlog'); }
        renderBody(root); return;
      }
      if (action === 'toggle-deck') {
        if (isInDeck(item, currentContext)) { await api(`/api/items/${canonical}/deck`, { method: 'DELETE' }); item.states = { ...(item.states || {}), inOnDeck: false }; toast('Quitado de On Deck'); renderBody(root); return; }
        const response = await postDeckWithReplacement(`/api/items/${canonical}/deck`); if (!response) return; mergeReturnedItem(response); item.states = { ...(item.states || {}), inOnDeck: true }; toast('Añadido a On Deck'); renderBody(root); return;
      }
      if (action === 'remove-collection') { const ok = await ui.confirm({ title: 'Quitar de Colecciones', message: 'Se retirará la calificación/finalización, pero el item seguirá en Base de datos y en otras vistas.', confirmText: 'Quitar' }); if (!ok) return; await api(`/api/items/${canonical}/collection`, { method: 'DELETE' }); item.rating = null; item.completedAt = null; item.states = { ...(item.states || {}), completed: false }; toast('Quitado de Colecciones'); renderBody(root); return; }
      if (action === 'delete-permanent') { const ok = await ui.confirm({ title: 'Eliminar definitivamente', message: 'Esto eliminará el item de la base de datos, Backlog, On Deck, Colecciones, grupos y assets locales asociados. ¿Continuar?', confirmText: 'Eliminar definitivamente', danger: true }); if (!ok) return; await api(`/api/items/${canonical}/delete`, { method: 'POST' }); currentContext = 'removed'; toast('Item eliminado definitivamente'); renderBody(root); return; }
    } finally { busy = false; }
  }
  return new Promise(resolve => {
    ui.open({ title: labels.title || '', className: 'ui-modal-root--item-detail', body: bodyMarkup(item, currentContext, collectionGroups, settings), actions: [] }).then(value => { try { if (window.location.hash.startsWith('#/item/')) window.history.replaceState(null, '', previousHash || '#/database'); } catch {} resolve(value); });
    requestAnimationFrame(() => { const root = document.querySelector('.ui-modal-root--item-detail'); if (!root) return; if (root.__itemDetailAbort) root.__itemDetailAbort.abort(); root.__itemDetailAbort = new AbortController(); root.addEventListener('click', async event => { const rateButton = event.target.closest('[data-item-rate]'); if (rateButton) { if (busy) return; busy = true; try { const rating = Number(rateButton.dataset.itemRate || 0); const result = await applyRating({ ui, api, item, context: currentContext, rating, toast }); if (result) renderBody(root); } finally { busy = false; } return; } const actionButton = event.target.closest('[data-detail-action]'); if (actionButton) await runAction(root, actionButton.dataset.detailAction); }, { signal: root.__itemDetailAbort.signal }); });
  });
}
