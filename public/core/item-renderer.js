import { escapeHtml, escapeAttr, typeFor, typeLabel, imageFor, backdropFor, detailFor, summaryLineFor, formatDate, groupsForItem, statePills, itemState, stableItemKey } from './item-utils.js';

export function stars(rating = 0) {
  const n = Math.max(0, Math.min(5, Number(rating) || 0));
  return n ? `<div class="media-card__completion media-card__completion--stars"><span>${'★'.repeat(n)}${'☆'.repeat(5-n)}</span></div>` : '';
}
export function dateLine(item = {}, { interactive = false } = {}) {
  const raw = item.lastActivityAt || item.lastSeenAt || item.updatedAt || item.createdAt;
  if (!raw) return '';
  const timestamp = new Date(raw).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86400000));
  const value = String(days);
  const label = days === 0 ? 'Último movimiento hoy' : `Último movimiento hace ${days} ${days === 1 ? 'día' : 'días'}`;
  if (interactive) return `<button type="button" class="media-card__date media-card__turn-button" data-quick-turn title="Dar la vuelta · ${escapeAttr(label.toLowerCase())}" aria-label="${escapeAttr(label)}. Dar la vuelta"><span aria-hidden="true">↻</span><strong>${escapeHtml(value)}d</strong></button>`;
  return `<time class="media-card__date" datetime="${escapeAttr(new Date(timestamp).toISOString())}" title="${escapeAttr(label)}">↻ ${escapeHtml(value)} d</time>`;
}
export function statePillsMarkup(item = {}, context = '') {
  const pills = statePills(item, context);
  return pills.length ? `<div class="item-state-pills">${pills.map(label => `<span>${escapeHtml(label)}</span>`).join('')}</div>` : '';
}
export function groupPillsMarkup(item = {}, groups = []) {
  const allMatched = groupsForItem(item, groups);
  const matched = allMatched.slice(0, 4);
  if (!matched.length) return '';
  return `<div class="item-group-pills">${matched.map(group => `<span role="button" tabindex="0" data-group-filter="${escapeAttr(group.id)}" title="Filtrar por ${escapeAttr(group.name)}">${escapeHtml(group.name)}</span>`).join('')}${allMatched.length > 4 ? `<span>+${allMatched.length - 4}</span>` : ''}</div>`;
}
export function itemCardMarkup(item = {}, { context = 'database', groups = [], format = 'standard', visibility = {} } = {}) {
  const img = imageFor(item);
  const bg = backdropFor(item);
  const key = stableItemKey(item);
  const grill = item.grill || {};
  const grillClass = grill.charred ? " is-charred" : grill.hot ? " is-hot" : "";
  const turnedClass = grill.turned ? " is-turned" : "";
  const formatClass = ` media-card--${escapeAttr(format)}`;
  const titleText = String(item.title || '');
  const detailText = String(summaryLineFor(item) || '');
  const titleLength = titleText.length;
  const detailLength = detailText.length;
  const titleWords = titleText.split(/\s+/).filter(Boolean);
  const detailWords = detailText.split(/\s+/).filter(Boolean);
  const longestTitleWord = titleWords.reduce((max, word) => Math.max(max, word.length), 0);
  const longestDetailWord = detailWords.reduce((max, word) => Math.max(max, word.length), 0);
  let titleFit = titleLength > 84 ? .88 : titleLength > 62 ? .92 : titleLength > 42 ? .96 : 1;
  let detailFit = detailLength > 96 ? .9 : detailLength > 72 ? .94 : detailLength > 48 ? .97 : 1;
  if (longestTitleWord > 24) titleFit *= .94;
  else if (longestTitleWord > 16) titleFit *= .97;
  if (longestDetailWord > 24) detailFit *= .94;
  else if (longestDetailWord > 16) detailFit *= .97;
  const defaults = format === 'simple' ? { title:true, subtype:false, context:true, detail:true, rating:true, date:false, type:false, groups:false, state:false, journal:true, grill:true } : { title:true, subtype:true, context:true, detail:true, rating:true, date:true, type:false, groups:true, state:true, journal:true, grill:true };
  const show = { ...defaults, ...(visibility || {}) };
  const canQuickTurn = context === 'backlog' || context === 'on-deck';
  
  return `<article style="--title-fit:${titleFit};--detail-fit:${detailFit}" class="media-card media-card--rich item-card source-${escapeAttr(item.source || 'other')}${grillClass}${turnedClass}${formatClass}" data-id="${escapeAttr(key)}" data-canonical-id="${escapeAttr(item.canonicalId || '')}" data-source="${escapeAttr(item.source || '')}">
    ${show.grill && (grill.hot || grill.charred) ? `<span class="media-card__heat" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M13.5 2s.8 3.2-1.8 5.8c-1.8 1.8-3.2 3.6-2.7 6.1.3 1.6 1.5 2.7 3 3.1-1.1-1.4-.7-3.4.5-4.5 1.5-1.4 1.8-2.8 1.7-4.1 2.7 2 4.8 4.7 4.8 8 0 3.1-2.5 5.6-5.7 5.6S7.5 19.5 7.5 16.4C7.5 10.1 13.5 8.2 13.5 2Z"/></svg></span>` : ""}
    ${bg ? `<div class="media-card__bg" style="background-image:url('${escapeAttr(bg)}')"></div>` : ''}
    ${format === 'standard' && canQuickTurn ? dateLine(item, { interactive: true }) : ''}
    <div class="media-card__surface">
      <div class="media-card__poster">${format === 'simple' && canQuickTurn ? dateLine(item, { interactive: true }) : ''}${show.journal && Number(item.journalCount || 0) ? `<span class="media-card__journal-count" title="${Number(item.journalCount)} entradas en el diario">✎ ${Number(item.journalCount)}</span>` : ''}${img ? `<img src="${escapeAttr(img)}" loading="lazy" alt="">` : `<div class="media-card__fallback">${escapeHtml((item.title || '?').slice(0,1))}</div>`}</div>
      <div class="media-card__meta">
        ${show.title ? `<strong>${escapeHtml(item.title || 'Sin título')}</strong>` : ''}
        ${show.detail && summaryLineFor(item) ? `<span class="media-card__detail">${escapeHtml(summaryLineFor(item))}</span>` : ''}
        ${show.rating ? stars(item.rating) : ''}
        
        ${show.type ? `<span class="media-card__type">${escapeHtml(typeLabel(typeFor(item)))}</span>` : ''}
        ${show.state ? statePillsMarkup(item, context) : ''}
        ${groupPillsMarkup(item, groups)}
      </div>
    </div>
  </article>`;
}
export function itemListMarkup(items = [], { context = 'database', groups = [] } = {}) {
  const supplementalLine = item => summaryLineFor(item);
  const ratingStars = item => {
    const value = Math.max(0, Math.min(5, Number(item.rating) || 0));
    const label = value ? `${value} de 5 estrellas` : 'Sin calificación';
    return `<span class="kiosko-list__rating" aria-label="${escapeAttr(label)}" title="${escapeAttr(label)}"><span aria-hidden="true">${'★'.repeat(value)}${'☆'.repeat(5-value)}</span></span>`;
  };
  return `<div class="kiosko-list unified-list" role="table">
    <div class="kiosko-list__row kiosko-list__row--head" role="row"><span aria-label="Carátula"></span><span>Título</span><span>Tipo</span><span>Estado</span><span>Rating</span><span>Último movimiento</span><span>Finalización</span></div>
    ${items.map(item => {
      const st = itemState(item, context);
      const status = [st.inBacklog ? 'Backlog' : '', st.inOnDeck ? 'On Deck' : '', st.inCollection ? 'Colección' : ''].filter(Boolean).join(' · ') || 'Base';
      const thumb = imageFor(item);
      const secondary = supplementalLine(item);
      const grill=item.grill||{}; const grillClass=grill.charred?" is-charred":grill.hot?" is-hot":""; return `<button type="button" class="kiosko-list__row item-list-row${grillClass}" role="row" data-id="${escapeAttr(stableItemKey(item))}" data-canonical-id="${escapeAttr(item.canonicalId || '')}" data-source="${escapeAttr(item.source || '')}"><span class="kiosko-list__thumb">${thumb ? `<img src="${escapeAttr(thumb)}" loading="lazy" alt="">` : `<span>${escapeHtml((item.title || '?').slice(0,1))}</span>`}</span><span class="kiosko-list__title"><strong>${escapeHtml(item.title || 'Sin título')}</strong>${secondary ? `<small>${escapeHtml(secondary)}</small>` : ''}${groupPillsMarkup(item, groups)}</span><span>${escapeHtml(typeLabel(typeFor(item)))}</span><span>${escapeHtml(status)}</span><span>${ratingStars(item)}</span><span>${escapeHtml(formatDate(item.lastActivityAt || item.updatedAt, { short: false }))}</span><span>${item.completedAt ? escapeHtml(formatDate(item.completedAt, { short: false })) : '—'}</span>${(grill.hot||grill.charred)?`<span class="kiosko-list__heat" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M13.5 2s.8 3.2-1.8 5.8c-1.8 1.8-3.2 3.6-2.7 6.1.3 1.6 1.5 2.7 3 3.1-1.1-1.4-.7-3.4.5-4.5 1.5-1.4 1.8-2.8 1.7-4.1 2.7 2 4.8 4.7 4.8 8 0 3.1-2.5 5.6-5.7 5.6S7.5 19.5 7.5 16.4C7.5 10.1 13.5 8.2 13.5 2Z"/></svg></span>`:""}</button>`;
    }).join('')}
  </div>`;
}

export function activeFilterChipsMarkup({ activeTypes = new Set(), activeGroupIds = new Set(), groups = [], source = '', status = '', search = '', groupMatch = 'any' } = {}) {
  const chips = [];
  for (const id of activeGroupIds) {
    const group = groups.find(g => g.id === id);
    if (group) chips.push(`<span class="active-filter-chip"><span>Lista: ${escapeHtml(group.name)}</span><button type="button" data-remove-group-filter="${escapeAttr(id)}" aria-label="Quitar filtro de la lista ${escapeAttr(group.name)}">×</button></span>`);
  }
  if (activeGroupIds.size > 1) chips.push(`<span class="active-filter-chip active-filter-chip--mode">${groupMatch === 'all' ? 'Todos los grupos' : 'Cualquier grupo'}</span>`);
  if (source) chips.push(`<span class="active-filter-chip">Fuente: ${escapeHtml(source)}</span>`);
  if (status) chips.push(`<span class="active-filter-chip">Estado: ${escapeHtml(status)}</span>`);
  if (search) chips.push(`<span class="active-filter-chip">Buscar: ${escapeHtml(search)}</span>`);
  return chips.length ? `<div class="active-filter-chips">${chips.join('')}</div>` : '';
}
export function paginationMarkup({ page = 1, pages = 1, total = 0 } = {}) {
  return `<nav class="pagination-bar unified-pagination" aria-label="Paginación"><button type="button" data-page-prev ${page <= 1 ? 'disabled' : ''}>‹</button><strong>${page}/${pages}</strong><button type="button" data-page-next ${page >= pages ? 'disabled' : ''}>›</button></nav>`;
}
