export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}
export function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
export function clamp(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}
export function cleanText(value) { return String(value ?? '').trim(); }
function titleCaseType(value = '') {
  return String(value || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Items';
}
export function typeFor(item = {}) {
  if (item.collectionType) return String(item.collectionType);
  if (item.source === 'playnite' || item.kind === 'game') return 'games';
  if (item.type === 'movie') return 'movies';
  return 'series';
}
export function typeLabel(item = {}) {
  const t = typeof item === 'string' ? item : typeFor(item);
  return t === 'games' ? 'Juegos' : t === 'movies' ? 'Películas' : t === 'series' ? 'Series' : titleCaseType(t);
}
export function typeSingular(item = {}) {
  const t = typeof item === 'string' ? item : typeFor(item);
  return t === 'games' ? 'Juego' : t === 'movies' ? 'Película' : t === 'series' ? 'Serie' : titleCaseType(t).replace(/s$/i, '');
}
export function sourceLabel(item = {}) {
  if (item.source === 'playnite' || item.kind === 'game') return 'Playnite';
  if (item.source === 'plex' || item.kind === 'plex') return 'Plex';
  if (item.source === 'kiosko' || item.meta?.createdByKiosko || item.metadata?.createdByKiosko) return 'Kiosko';
  return item.source ? String(item.source) : 'Fuente';
}
export function imageFor(item = {}) { return item.poster || item.posterUrl || item.cover || item.coverPath || ''; }
export function backdropFor(item = {}) { return item.backdrop || item.backdropUrl || item.background || item.backgroundAssetPath || imageFor(item); }
export function detailFor(item = {}) { return item.detail || item.subtitle || item.activitySubtitle || ''; }
export function summaryLineFor(item = {}) {
  const context = cleanText(item.context);
  const subtype = cleanText(item.subtype);
  const rawDetail = cleanText(detailFor(item));
  const norm = value => cleanText(value).toLowerCase();
  const excluded = new Set([norm(context), norm(subtype)].filter(Boolean));
  const detailParts = rawDetail.split(/\s*·\s*/).map(cleanText).filter(Boolean).filter(part => !excluded.has(norm(part)));
  const parts = [context, ...detailParts, subtype].filter(Boolean);
  const seen = new Set();
  return parts.filter(part => { const key = norm(part); if (!key || seen.has(key)) return false; seen.add(key); return true; }).join(' · ');
}
export function formatDate(value, options = {}) {
  const d = new Date(value || '');
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('es-ES', options.short ? { day:'2-digit', month:'short' } : { day:'2-digit', month:'short', year:'numeric' });
}
export function itemState(item = {}, context = '') {
  const states = item.states || {};
  return {
    inDatabase: true,
    inBacklog: states.inBacklog === true || item.tracked === true,
    inOnDeck: states.inOnDeck === true || item.inOnDeck === true,
    inCollection: states.completed === true || Boolean(item.completedAt),
    rating: Number(item.rating || 0),
    completedAt: item.completedAt || null
  };
}
export function statusFor(item = {}, context = '') {
  const st = itemState(item, context);
  if (st.inCollection) return 'completed';
  if (st.inOnDeck) return 'on-deck';
  if (st.inBacklog) return 'backlog';
  return 'known';
}
export function groupItemKeys(item = {}) {
  const meta = item.meta || item.metadata || {};
  return [...new Set([
    item.canonicalId, meta.canonicalId, item.id, item.gameId, meta.gameId, item.ratingKey, meta.ratingKey,
    meta.relatedSeriesCanonicalId, meta.relatedOnDeckCanonicalId,
    item.grandparentRatingKey ? `plex:series:${item.grandparentRatingKey}` : null,
    meta.grandparentRatingKey ? `plex:series:${meta.grandparentRatingKey}` : null,
    item.parentRatingKey && ['episode','season'].includes(item.type) ? `plex:series:${item.parentRatingKey}` : null
  ].filter(Boolean).map(String))];
}
function asArray(value) { return Array.isArray(value) ? value : (value ? [value] : []); }
export function fieldValues(item = {}, field = '') {
  const meta = item.meta || item.metadata || {};
  const platform = [...asArray(item.platforms), ...asArray(meta.platforms), ...asArray(item.platform), ...asArray(meta.platform), detailFor(item)];
  const map = {
    title: [item.title], source: [item.source], type: [item.collectionType, item.type, meta.plexType], subtype: [item.subtype], context: [item.context], detail: [detailFor(item)], status: [item.status], year: [item.year, item.releaseYear, meta.releaseYear],
    platform, platforms: platform,
    genre: [...asArray(item.genres), ...asArray(meta.genres), ...asArray(item.genre), ...asArray(meta.genre)],
    genres: [...asArray(item.genres), ...asArray(meta.genres), ...asArray(item.genre), ...asArray(meta.genre)],
    developer: [...asArray(item.developers), ...asArray(meta.developers), ...asArray(item.developer), ...asArray(meta.developer)],
    developers: [...asArray(item.developers), ...asArray(meta.developers), ...asArray(item.developer), ...asArray(meta.developer)],
    publisher: [...asArray(item.publishers), ...asArray(meta.publishers), ...asArray(item.publisher), ...asArray(meta.publisher)],
    publishers: [...asArray(item.publishers), ...asArray(meta.publishers), ...asArray(item.publisher), ...asArray(meta.publisher)]
  };
  return (map[field] || [item[field], meta[field]]).flat().filter(Boolean).map(value => String(value).toLowerCase());
}
export function itemMatchesGroup(item = {}, group = {}) {
  const keys = groupItemKeys(item);
  const manualIds = (group.manualItemIds || []).map(String);
  const manualKeys = (group.manualItemKeys || []).map(String);
  if (keys.some(key => manualIds.includes(key) || manualKeys.includes(key))) return true;
  if (group.mode === 'manual') return false;
  const rules = group.rules || [];
  if (!rules.length) return false;
  const checks = rules.map(rule => {
    const values = fieldValues(item, rule.field);
    const needle = String(rule.value || '').toLowerCase();
    if (!needle) return false;
    return rule.operator === 'equals' ? values.some(v => v === needle) : values.some(v => v.includes(needle));
  });
  return (group.match || 'all') === 'any' ? checks.some(Boolean) : checks.every(Boolean);
}
export function groupsForItem(item = {}, groups = []) { return (groups || []).filter(group => itemMatchesGroup(item, group)); }
export function stableItemKey(item = {}) { return item.canonicalId || item.id || `${item.source || 'item'}:${item.title || ''}`; }
export function searchHaystack(item = {}) {
  const meta = item.meta || item.metadata || {};
  return [item.title, item.subtype, item.context, detailFor(item), item.source, item.type, item.collectionType, item.year, meta.summary, meta.studio, meta.director, ...(item.genres || []), ...(meta.genres || [])].filter(Boolean).join(' ').toLowerCase();
}
export function statePills(item = {}, context = '') {
  const st = itemState(item, context);
  const pills = [];
  if (st.inBacklog && context !== 'backlog') pills.push('Backlog');
  if (st.inOnDeck && context !== 'on-deck') pills.push('On Deck');
  return pills;
}
