import { escapeHtml, escapeAttr, typeFor, typeLabel, imageFor, backdropFor, detailFor, formatDate, groupsForItem, statePills, itemState, stableItemKey } from './item-utils.js';

export function stars(rating = 0) {
  const n = Math.max(0, Math.min(5, Number(rating) || 0));
  return n ? `<div class="media-card__completion media-card__completion--stars"><span>${'★'.repeat(n)}${'☆'.repeat(5-n)}</span></div>` : '';
}
export function dateLine(item = {}) {
  const done = formatDate(item.completedAt, { short: true });
  if (done) return `<time class="media-card__date" title="Finalizado">✓ ${escapeHtml(done)}</time>`;
  const active = formatDate(item.lastActivityAt || item.lastSeenAt || item.updatedAt || item.createdAt, { short: true });
  return active ? `<time class="media-card__date" title="Última actividad">↻ ${escapeHtml(active)}</time>` : '';
}
export function statePillsMarkup(item = {}, context = '') {
  const pills = statePills(item, context);
  return pills.length ? `<div class="item-state-pills">${pills.map(label => `<span>${escapeHtml(label)}</span>`).join('')}</div>` : '';
}
export function groupPillsMarkup(item = {}, groups = []) {
  const matched = groupsForItem(item, groups).slice(0, 4);
  if (!matched.length) return '';
  return `<div class="item-group-pills">${matched.map(group => `<span>${escapeHtml(group.name)}</span>`).join('')}${groupsForItem(item, groups).length > 4 ? `<span>+${groupsForItem(item, groups).length - 4}</span>` : ''}</div>`;
}
export function itemCardMarkup(item = {}, { context = 'database', groups = [] } = {}) {
  const img = imageFor(item);
  const bg = backdropFor(item);
  const key = stableItemKey(item);
  return `<article class="media-card media-card--rich item-card source-${escapeAttr(item.source || 'other')}" data-id="${escapeAttr(key)}" data-canonical-id="${escapeAttr(item.canonicalId || '')}" data-source="${escapeAttr(item.source || '')}">
    ${bg ? `<div class="media-card__bg" style="background-image:url('${escapeAttr(bg)}')"></div>` : ''}
    <div class="media-card__surface">
      <div class="media-card__poster">${Number(item.journalCount || 0) ? `<span class="media-card__journal-count" title="${Number(item.journalCount)} entradas en el diario">✎ ${Number(item.journalCount)}</span>` : ''}${img ? `<img src="${escapeAttr(img)}" loading="lazy" alt="">` : `<div class="media-card__fallback">${escapeHtml((item.title || '?').slice(0,1))}</div>`}</div>
      <div class="media-card__meta">
        <strong>${escapeHtml(item.title || 'Sin título')}</strong>
        ${detailFor(item) ? `<span class="media-card__detail">${escapeHtml(detailFor(item))}</span>` : ''}
        ${stars(item.rating)}
        ${dateLine(item)}
        ${statePillsMarkup(item, context)}
        ${groupPillsMarkup(item, groups)}
      </div>
    </div>
  </article>`;
}
export function itemListMarkup(items = [], { context = 'database', groups = [] } = {}) {
  return `<div class="kiosko-list unified-list" role="table">
    <div class="kiosko-list__row kiosko-list__row--head" role="row"><span>Título</span><span>Fuente</span><span>Tipo</span><span>Estado</span><span>Rating</span><span>Fecha</span></div>
    ${items.map(item => {
      const st = itemState(item, context);
      const status = [st.inBacklog ? 'Backlog' : '', st.inOnDeck ? 'On Deck' : '', st.inCollection ? 'Calificado' : ''].filter(Boolean).join(' · ') || 'Base';
      return `<button type="button" class="kiosko-list__row item-list-row" role="row" data-id="${escapeAttr(stableItemKey(item))}" data-canonical-id="${escapeAttr(item.canonicalId || '')}" data-source="${escapeAttr(item.source || '')}"><span><strong>${escapeHtml(item.title || 'Sin título')}</strong><small>${escapeHtml(detailFor(item))}</small>${groupPillsMarkup(item, groups)}</span><span>${escapeHtml(item.source || '')}</span><span>${escapeHtml(typeLabel(typeFor(item)))}</span><span>${escapeHtml(status)}</span><span>${item.rating ? escapeHtml(String(item.rating)) : '—'}</span><span>${escapeHtml(formatDate(item.completedAt || item.lastActivityAt || item.updatedAt, { short: false }))}</span></button>`;
    }).join('')}
  </div>`;
}
export function activeFilterChipsMarkup({ activeTypes = new Set(), activeGroupIds = new Set(), groups = [], source = '', status = '', search = '', groupMatch = 'any' } = {}) {
  const chips = [];
  if (activeTypes.size && activeTypes.size < 3) chips.push(...[...activeTypes].map(type => typeLabel(type)));
  for (const id of activeGroupIds) {
    const group = groups.find(g => g.id === id);
    if (group) chips.push(`Grupo: ${group.name}`);
  }
  if (activeGroupIds.size > 1) chips.push(groupMatch === 'all' ? 'Todos los grupos' : 'Cualquier grupo');
  if (source) chips.push(`Fuente: ${source}`);
  if (status) chips.push(`Estado: ${status}`);
  if (search) chips.push(`Buscar: ${search}`);
  return chips.length ? `<div class="active-filter-chips">${chips.map(chip => `<span>${escapeHtml(chip)}</span>`).join('')}</div>` : '';
}
export function paginationMarkup({ page = 1, pages = 1, total = 0 } = {}) {
  return `<nav class="pagination-bar unified-pagination" aria-label="Paginación"><button type="button" data-page-prev ${page <= 1 ? 'disabled' : ''}>‹</button><strong>${page}/${pages}</strong><button type="button" data-page-next ${page >= pages ? 'disabled' : ''}>›</button></nav>`;
}
