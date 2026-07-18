function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
function text(value) { return Array.isArray(value) ? value.filter(Boolean).join(' · ') : (value ? String(value) : ''); }

function typeFor(item = {}) {
  if (item.collectionType === 'games' || item.source === 'playnite' || item.kind === 'game') return 'games';
  if (item.collectionType === 'movies') return 'movies';
  return 'series';
}
function typeLabel(item = {}, settings = {}) {
  const type = collectionTypeFor(item);
  const configured = customTypesFromSettings(settings).find(entry => entry.id === type);
  if (configured) return configured.singular || configured.plural || type;
  return type === 'games' ? 'Juego' : type === 'movies' ? 'Película' : type === 'series' ? 'Serie' : String(type || 'Item').replace(/[-_]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}
function sourceLabel(item = {}) {
  if (item.source === 'playnite' || item.kind === 'game') return 'Playnite';
  if (item.source === 'plex' || item.kind === 'plex') return 'Plex';
  if (item.source === 'kiosko' || item.meta?.createdByKiosko || item.metadata?.createdByKiosko) return 'Kiosko';
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
function relativeDaysText(value) {
  const date = new Date(value || '');
  if (!Number.isFinite(date.getTime())) return '';
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  if (!days) return 'Hoy';
  if (days === 1) return 'Hace 1 día';
  return `Hace ${days} días`;
}
function activityStateDescriptor(item = {}) {
  if (item.states?.charred || item.grill?.charred) return { key: 'charred', label: 'Achicharrado' };
  if (item.grill?.hot) return { key: 'hot', label: 'Quemándose' };
  return { key: 'normal', label: '' };
}
function activityTurnButtonMarkup(item = {}) {
  const date = item.lastActivityAt || item.lastSeenAt || item.firstSeenAt || item.completedAt;
  if (!date) return '';
  const state = activityStateDescriptor(item);
  const icon = item.completedAt ? '✓' : (item.lastActivityAt || item.lastSeenAt) ? '↻' : '＋';
  const label = item.completedAt ? 'Finalización' : (item.lastActivityAt || item.lastSeenAt) ? 'Última actividad' : 'Entrada en base de datos';
  return `<button type="button" class="item-detail__activity-turn ${state.key !== 'normal' ? `is-${state.key}` : ''}" data-detail-action="activity" title="Actualizar actividad" aria-label="${escapeAttr(label)}: ${escapeAttr(formatDate(date))}"><span class="item-detail__activity-turn-date"><span class="item-detail__activity-turn-icon">${icon}</span><span class="item-detail__activity-turn-copy"><strong>${escapeHtml(formatDate(date))}</strong><small>${escapeHtml(relativeDaysText(date))}</small></span></span>${state.label ? `<span class="item-detail__activity-turn-state">${escapeHtml(state.label)}</span>` : ''}</button>`;
}
function itemDateLine(item = {}) {
  const date = item.completedAt || item.lastActivityAt || item.lastSeenAt || item.firstSeenAt;
  if (!date) return '';
  const label = item.completedAt ? 'Fecha de finalización' : (item.lastActivityAt || item.lastSeenAt) ? 'Última actividad' : 'Entrada en base de datos';
  const icon = item.completedAt ? '✓' : (item.lastActivityAt || item.lastSeenAt) ? '↻' : '＋';
  return `<button type="button" class="item-detail__date-line item-detail__date-action" data-detail-action="activity" title="Actualizar actividad" aria-label="Actualizar actividad. ${escapeAttr(label)}: ${escapeAttr(formatDate(date))}"><span>${icon}</span>${escapeHtml(formatDate(date))}</button>`;
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
  if (context === 'collections') return item.rating ? `Valorado · ${'★'.repeat(Number(item.rating)||0)}${'☆'.repeat(5-(Number(item.rating)||0))}` : 'Colección';
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
  const rating = Math.max(0, Math.min(5, Number(item.rating) || 0));
  if (!['backlog', 'on-deck', 'collections', 'current', 'database'].includes(context)) return '';
  const stars = rating ? `${'★'.repeat(rating)}${'☆'.repeat(5-rating)}` : '☆☆☆☆☆';
  const status = item.states?.completed || item.completedAt ? 'Terminado' : rating ? `${rating} de 5` : 'Valorar';
  return `<button type="button" class="item-detail__assessment-trigger" data-detail-action="assessment" aria-label="Abrir valoración y finalización"><span class="item-detail__assessment-stars">${stars}</span><small>${escapeHtml(status)}</small></button>`;
}
function isInBacklog(item = {}, context = '') { return item.states?.inBacklog === true; }
function isInDeck(item = {}, context = '') { return item.states?.inOnDeck === true; }
function isInCollection(item = {}, context = '') { return item.states?.completed === true || Boolean(item.completedAt); }
function isManualEditableItem(item = {}) {
  return item.source === 'kiosko' || item.source === 'manual' || item.meta?.createdByKiosko || item.metadata?.createdByKiosko;
}
function collectionTypeFor(item = {}) {
  if (item.collectionType) return String(item.collectionType);
  if (item.source === 'playnite') return 'games';
  if (item.type === 'movie') return 'movies';
  return 'series';
}
const BASE_ITEM_TYPES = [
  { id: 'games', singular: 'Juego', plural: 'Juegos' },
  { id: 'movies', singular: 'Película', plural: 'Películas' },
  { id: 'series', singular: 'Serie', plural: 'Series' }
];
function customTypesFromSettings(settings = {}) {
  const seen = new Set(BASE_ITEM_TYPES.map(type => type.id));
  return [...BASE_ITEM_TYPES, ...(Array.isArray(settings.itemTypes) ? settings.itemTypes : []).filter(type => type?.id && !seen.has(type.id) && seen.add(type.id)).map(type => ({ id: type.id, singular: type.singular || type.label || type.id, plural: type.plural || type.label || type.singular || type.id }))];
}
function manualTypeOptions(settings = {}, current = 'movies') {
  const types = customTypesFromSettings(settings);
  if (current && !types.some(type => type.id === current)) types.push({ id: current, singular: current, plural: current });
  return types.map(type => `<option value="${escapeAttr(type.id)}" ${type.id === current ? 'selected' : ''}>${escapeHtml(type.singular || type.plural || type.id)}</option>`).join('');
}
async function fileToDataUri(file) {
  if (!file) return '';
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

function statePillsMarkup(item = {}, context = '', settings = {}) {
  const pills = [typeLabel(item, settings)];
  return `<div class="item-detail__identity"><div class="item-detail__state-pills">${pills.map(label => `<span class="deck-pill item-detail__status">${escapeHtml(label)}</span>`).join('')}</div><span class="item-detail__source-label">${escapeHtml(sourceLabel(item))}</span></div>`;
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
  return `<div class="item-detail__groups item-detail__groups--compact" data-detail-groups><div class="item-detail__groups-head"><span>Grupos</span><button type="button" class="item-detail__group-add" data-detail-action="groups" aria-label="Gestionar grupos" title="Gestionar grupos"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></div>${activeGroups.length ? `<div class="item-detail__group-list">${activeGroups.map(group => `<span class="item-detail__group-chip">${escapeHtml(group.name)}</span>`).join('')}</div>` : ''}<div class="item-detail__group-picker" data-detail-group-picker hidden></div></div>`;
}
function workspaceActionIcon(kind = 'backlog') {
  if (kind === 'deck') return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h9v3H5V7Zm0 7h14v3H5v-3Zm11-7 3 1.9L16 11V7Z"/></svg>`;
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h10a2 2 0 0 1 2 2v10H9a2 2 0 0 1-2-2V5Zm-2 4H3v10a2 2 0 0 0 2 2h10v-2H7V9Z"/></svg>`;
}
function primaryActionsMarkup(item = {}, context = '') {
  const backlog = isInBacklog(item, context);
  const deck = isInDeck(item, context);
  if (backlog) return `<button type="button" class="item-detail__quick item-detail__quick--remove item-detail__quick--workspace" data-detail-action="toggle-backlog">${workspaceActionIcon('backlog')}<span>Quitar de Backlog</span></button><button type="button" class="item-detail__quick item-detail__quick--move item-detail__quick--workspace" data-detail-action="toggle-deck">${workspaceActionIcon('deck')}<span>Mover a Deck</span></button>`;
  if (deck) return `<button type="button" class="item-detail__quick item-detail__quick--move item-detail__quick--workspace" data-detail-action="toggle-backlog">${workspaceActionIcon('backlog')}<span>Mover a Backlog</span></button><button type="button" class="item-detail__quick item-detail__quick--remove item-detail__quick--workspace" data-detail-action="toggle-deck">${workspaceActionIcon('deck')}<span>Quitar de Deck</span></button>`;
  return `<button type="button" class="item-detail__quick item-detail__quick--add item-detail__quick--workspace" data-detail-action="toggle-backlog">${workspaceActionIcon('backlog')}<span>Añadir a Backlog</span></button><button type="button" class="item-detail__quick item-detail__quick--add item-detail__quick--workspace" data-detail-action="toggle-deck">${workspaceActionIcon('deck')}<span>Añadir a Deck</span></button>`;
}
function grillTurnButtonMarkup(item = {}) { return activityTurnButtonMarkup(item); }
function detailActionsMarkup(item = {}, context = '') {
  if (context === 'removed') return `<div class="item-detail__actions item-detail__actions--clean" data-detail-actions><span class="settings-help">Este elemento se ha eliminado del contexto actual.</span></div>`;
  return `<div class="item-detail__actions item-detail__actions--clean" data-detail-actions>
    <div class="item-detail__quick-group">${primaryActionsMarkup(item, context)}</div>
    <button type="button" class="item-detail__edit-trigger" data-detail-action="edit" title="Editar item" aria-label="Editar item">✎</button>
  </div>`;
}

function journalPreviewMarkup(item = {}) {
  const review = item.review;
  const latest = item.latestJournalEntry;
  if (!review && !latest) return '';
  const card = (entry, kind) => `<article class="item-detail__note item-detail__note--${kind} ${kind === 'journal' ? 'item-detail__note--clickable' : ''}" ${kind === 'journal' ? 'data-detail-action="journal" role="button" tabindex="0"' : ''}><div class="item-detail__note-head"><strong>${kind === 'review' ? 'Review' : 'Última entrada'}</strong><time>${escapeHtml(formatDate(entry.updatedAt || entry.activityAt || entry.createdAt))}</time></div>${entry.comment ? `<p>${escapeHtml(entry.comment)}</p>` : ''}${entry.image ? `<button type="button" class="item-detail__note-image" data-journal-image="${escapeAttr(entry.image)}"><img src="${escapeAttr(entry.image)}" alt=""></button>` : ''}</article>`;
  return `<section class="item-detail__notes">${review ? card(review, 'review') : ''}${latest ? card(latest, 'journal') : ''}</section>`;
}
function journalButtonMarkup(item = {}) {
  const count = Number(item.journalCount || 0);
  if (!count) return '';
  return `<button type="button" class="item-detail__journal-link" data-detail-action="journal">Diario · ${count}</button>`;
}
function journalComposerMarkup({ comment = '', image = '', detail = '', includeDetail = false } = {}) {
  return `<div class="journal-composer">${includeDetail ? `<label class="ui-field"><span>Detalle / estado</span><input data-journal-detail value="${escapeAttr(detail)}" placeholder="Qué ha ocurrido"></label>` : ''}<label class="ui-field"><span>Comentario <small data-journal-count>${String(comment).length}/140</small></span><textarea maxlength="140" data-journal-comment placeholder="Escribe una nota breve…">${escapeHtml(comment)}</textarea></label><div class="journal-dropzone" data-journal-dropzone tabindex="0"><strong>Pega, arrastra o selecciona una imagen</strong><small>JPEG, PNG o WebP · máximo 5 MB</small><input type="file" accept="image/jpeg,image/png,image/webp" data-journal-file></div><div class="journal-image-preview" data-journal-preview ${image ? '' : 'hidden'}>${image ? `<img src="${escapeAttr(image)}" alt=""><button type="button" data-journal-remove-image>Quitar imagen</button>` : ''}</div></div>`;
}
async function setupJournalComposer(root) {
  const textarea = root.querySelector('[data-journal-comment]');
  const counter = root.querySelector('[data-journal-count]');
  const fileInput = root.querySelector('[data-journal-file]');
  const dropzone = root.querySelector('[data-journal-dropzone]');
  const preview = root.querySelector('[data-journal-preview]');
  let imageData = '';
  let removeImage = false;
  const updateCount = () => { if (counter && textarea) counter.textContent = `${textarea.value.length}/140`; };
  const showFile = async file => { if (!file) return; if (file.size > 5*1024*1024) throw new Error('La imagen supera 5 MB.'); imageData = await fileToDataUri(file); removeImage = false; if (preview) { preview.hidden = false; preview.innerHTML = `<img src="${escapeAttr(imageData)}" alt=""><button type="button" data-journal-remove-image>Quitar imagen</button>`; } };
  textarea?.addEventListener('input', updateCount); updateCount();
  fileInput?.addEventListener('change', () => showFile(fileInput.files?.[0]).catch(error => alert(error.message)));
  dropzone?.addEventListener('dragover', event => { event.preventDefault(); dropzone.classList.add('is-dragging'); });
  dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('is-dragging'));
  dropzone?.addEventListener('drop', event => { event.preventDefault(); dropzone.classList.remove('is-dragging'); showFile(event.dataTransfer?.files?.[0]).catch(error => alert(error.message)); });
  root.addEventListener('paste', event => { const file = [...(event.clipboardData?.files || [])].find(f => f.type.startsWith('image/')); if (file) { event.preventDefault(); showFile(file).catch(error => alert(error.message)); } });
  root.addEventListener('click', event => { if (event.target.closest('[data-journal-remove-image]')) { imageData = ''; removeImage = true; if (preview) { preview.hidden = true; preview.innerHTML = ''; } } });
  return () => ({ comment: textarea?.value.trim() || '', detail: root.querySelector('[data-journal-detail]')?.value || '', imageData, removeImage });
}

function bodyMarkup(item = {}, context = '', collectionGroups = [], settings = {}) {
  const subtitle = item.detail || item.subtitle || (Array.isArray(item.platforms) ? item.platforms.join(' · ') : typeLabel(item, settings));
  const backdrop = effectiveBackdrop(item, settings);
  return `<div class="item-detail ${detailDesignClass(settings)} ${backdrop ? 'item-detail--has-bg' : ''}">
    ${grillTurnButtonMarkup(item)}
    ${backdrop ? `<div class="item-detail__backdrop" style="background-image:url('${escapeAttr(backdrop)}')"></div>` : ''}
    <div class="item-detail__poster">${posterMarkup(item)}</div>
    <div class="item-detail__info">
      <div class="item-detail__status-row">${statePillsMarkup(item, context, settings)}</div>
      <h3>${escapeHtml(item.title || 'Sin título')}</h3>
      <div class="item-detail__activity">${subtitle ? `<p class="item-detail__subtitle">${escapeHtml(subtitle)}</p>` : ''}</div>
      <div class="item-detail__rating-block"><div class="item-detail__rating-label"><span>Valoración y estado</span></div>${ratingControlMarkup(item, context)}</div>
      ${journalPreviewMarkup(item)}
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
  const removeFromDeck = true;
  const canonical = encodeURIComponent(item.canonicalId || item.id);
  let response;
  if (context === 'current') response = await api('/api/current/complete', { method: 'POST', body: JSON.stringify({ rating, removeFromDeck }) });
  else response = await api(`/api/items/${canonical}/complete`, { method: 'POST', body: JSON.stringify({ rating, removeFromDeck, from: context }) });
  Object.assign(item, response.completed || {}, { rating: Number(rating), completedAt: response.completed?.completedAt || item.completedAt, status: 'completed', states: { ...(item.states || {}), completed: true, inOnDeck: false, inBacklog: false } });
  toast('Calificado y movido a Colección');
  return { context, completed: response.completed };
}

export async function openItemDetail({ ui, api, item, context, toast = () => {}, labels = {}, collectionGroups = [], settings = {}, onItemUpdated = () => {} }) {
  if (!item) return null;
  let currentContext = context;
  let busy = false;
  const previousHash = window.location.hash;
  try { if (item.canonicalId) window.history.replaceState(null, '', `#/item/${encodeURIComponent(item.canonicalId)}?from=${encodeURIComponent(context || 'database')}`); } catch {}
  const mergeReturnedItem = payload => { const next = payload?.completed || payload?.deckItem || payload?.backlogItem || payload?.item || payload; if (next && typeof next === 'object') { Object.assign(item, next); onItemUpdated({ ...item }); } };
  const followItem = (root, destination, reason = 'moved') => {
    const detail = { id: destination, reason, item: { id: item.id, canonicalId: item.canonicalId, collectionType: collectionTypeFor(item), title: item.title } };
    root?.querySelector('[data-modal-close]')?.click();
    requestAnimationFrame(() => document.dispatchEvent(new CustomEvent('bbqueue:follow-item', { detail })));
  };
  const syncDetailState = root => {
    if (!root) return;
    const hot = Boolean(item.grill?.hot);
    const charred = Boolean(item.states?.charred || item.grill?.charred);
    root.classList.toggle('is-hot', hot && !charred);
    root.classList.toggle('is-charred', charred);
  };
  const renderBody = root => { const body = root.querySelector('.ui-modal__body'); if (body) body.innerHTML = bodyMarkup(item, currentContext, collectionGroups, settings); syncDetailState(root); };
  try {
    const journal = await api(`/api/items/${encodeURIComponent(item.canonicalId || item.id)}/journal?page=1&limit=1`);
    item.review = journal.review || null;
    item.journalCount = Number(journal.total || 0);
    item.latestJournalEntry = journal.items?.[0] || null;
  } catch {}
  const refreshGroups = async () => { const response = await api('/api/collection-groups').catch(() => null); if (response?.groups) collectionGroups = response.groups; return collectionGroups; };
  function renderInlineGroupPicker(root) { const picker = root.querySelector('[data-detail-group-picker]'); if (!picker) return; const keys = groupItemKeys(item); if (!keys.length) { picker.hidden = false; picker.innerHTML = `<p class="settings-help">No hay una clave estable para este item.</p>`; return; } if (!collectionGroups.length) { picker.hidden = false; picker.innerHTML = `<p class="settings-help">No hay grupos creados.</p>`; return; } picker.hidden = false; picker.innerHTML = `<div class="groups-picker groups-picker--inline">${collectionGroups.map(group => `<label class="controls-modal__toggle"><input type="checkbox" data-group-pick="${escapeAttr(group.id)}" ${itemInGroup(item, group) ? 'checked' : ''}><span>${escapeHtml(group.name)}</span><small>${escapeHtml(group.mode || 'manual')}</small></label>`).join('')}</div><div class="item-detail__group-picker-actions"><button type="button" class="ui-modal__button" data-detail-action="groups-cancel">Cancelar</button><button type="button" class="ui-modal__button ui-modal__button--primary" data-detail-action="groups-save">Guardar grupos</button></div>`; }
  async function saveInlineGroups(root) { if (busy) return; const keys = groupItemKeys(item); const primaryKey = keys[0]; if (!primaryKey) { toast('No hay una clave estable para este item'); return; } busy = true; const selected = new Set([...root.querySelectorAll('[data-group-pick]:checked')].map(input => input.dataset.groupPick)); for (const group of collectionGroups) { const active = itemInGroup(item, group); if (selected.has(group.id) && !active) await api(`/api/collection-groups/${encodeURIComponent(group.id)}/items`, { method: 'POST', body: JSON.stringify({ itemId: primaryKey, itemKeys: keys }) }); if (!selected.has(group.id) && active) await api(`/api/collection-groups/${encodeURIComponent(group.id)}/items/${encodeURIComponent(primaryKey)}`, { method: 'DELETE', body: JSON.stringify({ itemKeys: keys }) }); } await refreshGroups(); busy = false; toast('Grupos actualizados'); window.dispatchEvent(new CustomEvent('kiosko:collection-groups-changed')); renderBody(root); }
  async function chooseDeckReplacement(limitPayload = {}) { const categoryLabel = { games: 'juegos', movies: 'películas', series: 'series' }[limitPayload.category] || 'items'; const cards = (limitPayload.currentItems || []).map(entry => { const img = entry.poster || entry.posterUrl || entry.cover || ''; const initial = escapeHtml((entry.title || '?').slice(0, 1)); return `<label class="deck-replace-card"><input type="radio" name="deck-replace" value="${escapeAttr(entry.id)}"><span class="deck-replace-card__poster">${img ? `<img src="${escapeAttr(img)}" alt="">` : `<span>${initial}</span>`}</span><strong>${escapeHtml(entry.title || 'Sin título')}</strong><small>${escapeHtml(entry.subtitle || '')}</small></label>`; }).join(''); const result = await ui.open({ title: 'Límite de On Deck', className: 'ui-modal-root--wide', body: `<div class="deck-limit-modal"><p>Ya tienes ${limitPayload.limit || 3} ${categoryLabel} en On Deck. Para añadir <strong>${escapeHtml(limitPayload.newItem?.title || item.title || 'este item')}</strong>, elige cuál quieres reemplazar.</p><div class="deck-replace-grid">${cards}</div></div>`, actions: [{ label: 'Cancelar', value: null }, { label: 'Reemplazar seleccionado', variant: 'primary', onClick: root => root.querySelector('input[name="deck-replace"]:checked')?.value || false }] }); return result || null; }
  async function postDeckWithReplacement(path) { try { return await api(path, { method: 'POST' }); } catch (error) { if (error.status !== 409 || error.data?.reason !== 'deck_limit_reached') throw error; const replaceId = await chooseDeckReplacement(error.data); if (!replaceId) return null; return api(path, { method: 'POST', body: JSON.stringify({ replaceId }) }); } }
  async function editItem(root) {
    const manual = isManualEditableItem(item);
    const manualFields = manual ? `<section class="controls-modal__section"><h3>Datos principales</h3>
      <label class="ui-field"><span>Título</span><input data-edit-title value="${escapeAttr(item.title || '')}" required></label>
      <label class="ui-field"><span>Tipo</span><select data-edit-type>${manualTypeOptions(settings, collectionTypeFor(item))}</select></label>
      <label class="ui-field"><span>Carátula URL / asset</span><input data-edit-poster value="${escapeAttr(item.poster || '')}"></label>
      <label class="ui-field"><span>Backdrop URL / asset</span><input data-edit-backdrop value="${escapeAttr(item.backdrop || '')}"></label>
      <label class="ui-field"><span>Subir carátula</span><input type="file" accept="image/*" data-edit-poster-file></label>
      <label class="ui-field"><span>Subir backdrop</span><input type="file" accept="image/*" data-edit-backdrop-file></label>
    </section>` : '';
    const result = await ui.open({
      title: 'Editar item',
      className: 'ui-modal-root--wide',
      body: `<div class="controls-modal">${manualFields}<section class="controls-modal__section"><h3>Estado / detalle</h3><label class="ui-field"><span>Detalle visible</span><input type="text" data-detail-subtitle value="${escapeAttr(item.detail || item.subtitle || '')}" placeholder="Última actividad, plataforma, episodio..."></label><p class="settings-help">Al modificar el detalle se actualiza la fecha de última actividad. Las integraciones podrán volver a actualizarlo.</p></section><section class="controls-modal__section"><h3>Fechas</h3><label class="ui-field"><span>Entrada en base de datos</span><input type="date" data-date-first value="${escapeAttr(inputDate(item.firstSeenAt))}"></label><label class="ui-field"><span>Última actividad</span><input type="date" data-date-activity value="${escapeAttr(inputDate(item.lastActivityAt || item.lastSeenAt))}"></label><label class="ui-field"><span>Finalización</span><input type="date" data-date-completed value="${escapeAttr(inputDate(item.completedAt))}"></label></section><section class="controls-modal__section debug-item-state"><h3>Depuración</h3><label class="ui-check"><input type="checkbox" data-edit-charred ${item.states?.charred || item.grill?.charred ? 'checked' : ''}> Marcar como achicharrado</label><p class="settings-help">Marca visualmente el item sin cambiar el espacio al que pertenece.</p></section></div>`,
      actions: [
        { label: 'Eliminar', value: '__delete__', variant: 'danger' },
        { label: 'Cancelar', value: null },
        { label: 'Guardar', variant: 'primary', onClick: async modal => ({
          subtitle: modal.querySelector('[data-detail-subtitle]')?.value || '',
          firstSeenAt: modal.querySelector('[data-date-first]')?.value || null,
          lastActivityAt: modal.querySelector('[data-date-activity]')?.value || null,
          completedAt: modal.querySelector('[data-date-completed]')?.value || null,
          charred: modal.querySelector('[data-edit-charred]')?.checked === true,
          manual: manual ? {
            title: modal.querySelector('[data-edit-title]')?.value?.trim() || item.title,
            collectionType: modal.querySelector('[data-edit-type]')?.value || collectionTypeFor(item),
            poster: modal.querySelector('[data-edit-poster]')?.value || '',
            backdrop: modal.querySelector('[data-edit-backdrop]')?.value || '',
            posterAsset: await fileToDataUri(modal.querySelector('[data-edit-poster-file]')?.files?.[0]),
            backdropAsset: await fileToDataUri(modal.querySelector('[data-edit-backdrop-file]')?.files?.[0])
          } : null
        }) }
      ]
    });
    if (!result) return;
    if (result === '__delete__') {
      const ok = await ui.confirm({ title: 'Eliminar definitivamente', message: 'Esto eliminará el item de todas las vistas y grupos. ¿Continuar?', confirmText: 'Eliminar definitivamente', danger: true });
      if (!ok) return;
      await api(`/api/items/${encodeURIComponent(item.canonicalId || item.id)}/delete`, { method: 'POST' });
      currentContext = 'removed';
      toast('Item eliminado definitivamente');
      renderBody(root);
      return;
    }
    if (result.manual) {
      const response = await api(`/api/items/${encodeURIComponent(item.canonicalId)}`, { method: 'PATCH', body: JSON.stringify({ ...result.manual, detail: result.subtitle }) });
      mergeReturnedItem(response);
    }
    const payload = Object.fromEntries(Object.entries({ subtitle: result.subtitle, firstSeenAt: result.firstSeenAt, lastActivityAt: result.lastActivityAt, completedAt: result.completedAt }).map(([key, value]) => [key, key === 'subtitle' ? value : (value ? `${value}T12:00:00.000Z` : null)]));
    const response = await api(`/api/items/${encodeURIComponent(item.canonicalId)}/dates`, { method: 'PATCH', body: JSON.stringify(payload) });
    mergeReturnedItem(response);
    const isCharred = Boolean(item.states?.charred || item.grill?.charred);
    if (result.charred !== isCharred) {
      const grillResponse = await api(`/api/items/${encodeURIComponent(item.canonicalId)}/grill/char`, { method: result.charred ? 'POST' : 'DELETE' });
      mergeReturnedItem(grillResponse);
    }
    toast('Item actualizado');
    onItemUpdated({ ...item });
    renderBody(root);
  }
  async function editManualData(root) {
    if (!isManualEditableItem(item)) return;
    const currentType = collectionTypeFor(item);
    const result = await ui.open({
      title: 'Editar datos principales',
      className: 'ui-modal-root--wide',
      body: `<div class="manual-item-form manual-item-form--detail">
        <div class="manual-item-preview">
          <div class="manual-item-preview__backdrop" style="${(item.backdrop || item.backdropUrl || item.background) ? `background-image:url('${escapeAttr(item.backdrop || item.backdropUrl || item.background)}')` : ''}"></div>
          <div class="manual-item-preview__poster">${(item.poster || item.posterUrl || item.cover) ? `<img src="${escapeAttr(item.poster || item.posterUrl || item.cover)}" alt="">` : `<span>${escapeHtml((item.title || '?').slice(0,1))}</span>`}</div>
          <div><strong>${escapeHtml(item.title || 'Nuevo item')}</strong><small>${escapeHtml(item.detail || item.subtitle || '')}</small></div>
        </div>
        <label class="ui-field"><span>Título</span><input data-manual-title value="${escapeAttr(item.title || '')}" required></label>
        <label class="ui-field"><span>Detalle / estado</span><input data-manual-detail value="${escapeAttr(item.detail || item.subtitle || '')}" placeholder="Estado visible del item"></label>
        <label class="ui-field"><span>Tipo</span><select data-manual-type>${manualTypeOptions(settings, currentType)}</select></label>
        <label class="ui-field"><span>Carátula URL / asset</span><input data-manual-poster value="${escapeAttr(item.poster || '')}" placeholder="https://... o /assets/..."></label>
        <label class="ui-field"><span>Subir carátula</span><input type="file" accept="image/*" data-manual-poster-file></label>
        <label class="ui-field"><span>Backdrop URL / asset</span><input data-manual-backdrop value="${escapeAttr(item.backdrop || '')}" placeholder="https://... o /assets/..."></label>
        <label class="ui-field"><span>Subir backdrop</span><input type="file" accept="image/*" data-manual-backdrop-file></label>
      </div>`,
      actions: [
        { label: 'Cancelar', value: null },
        { label: 'Guardar', variant: 'primary', onClick: async modal => {
          const title = modal.querySelector('[data-manual-title]')?.value?.trim();
          if (!title) return false;
          const posterFile = modal.querySelector('[data-manual-poster-file]')?.files?.[0];
          const backdropFile = modal.querySelector('[data-manual-backdrop-file]')?.files?.[0];
          return {
            title,
            detail: modal.querySelector('[data-manual-detail]')?.value || '',
            collectionType: modal.querySelector('[data-manual-type]')?.value || 'movies',
            poster: modal.querySelector('[data-manual-poster]')?.value || '',
            backdrop: modal.querySelector('[data-manual-backdrop]')?.value || '',
            posterAsset: await fileToDataUri(posterFile),
            backdropAsset: await fileToDataUri(backdropFile)
          };
        }}
      ]
    });
    if (!result) return;
    const response = await api(`/api/items/${encodeURIComponent(item.canonicalId)}`, { method: 'PATCH', body: JSON.stringify(result) });
    mergeReturnedItem(response);
    toast('Datos principales actualizados');
    onItemUpdated({ ...item });
    renderBody(root);
  }


  async function openImagePopup(src) { await ui.open({ title: '', className: 'ui-modal-root--image-viewer', body: `<div class="journal-image-viewer"><img src="${escapeAttr(src)}" alt="Imagen del diario"></div>`, actions: [{ label: 'Cerrar', value: null }] }); }
  async function composeActivity(root) {
    let getter = null;
    const result = await ui.open({ title: 'Actualizar actividad', className: 'ui-modal-root--wide', body: journalComposerMarkup({ detail: item.detail || item.subtitle || '', includeDetail: true }), actions: [{ label: 'Cancelar', value: null }, { label: 'Guardar actividad', variant: 'primary', onClick: modal => getter?.() || false }], onMount: modal => {} });
    return result;
  }
  function subviewMarkup(title, content, { backAction = 'subview-back', eyebrow = '' } = {}) {
    return `<section class="item-detail-subview"><header class="item-detail-subview__header"><div>${eyebrow ? `<span>${escapeHtml(eyebrow)}</span>` : ''}<h3>${escapeHtml(title)}</h3></div><button type="button" class="item-detail-subview__back" data-detail-action="${escapeAttr(backAction)}">← Resumen</button></header>${content}</section>`;
  }
  function renderInfoSubview(root, markup) { const info = root.querySelector('.item-detail__info'); if (info) info.innerHTML = markup; }
  async function showActivityForm(root, { journalOnly = false } = {}) {
    const checked = journalOnly ? 'checked' : '';
    const body = `<form class="item-detail-form" data-activity-form>
      <label class="ui-field"><span>Detalle / estado</span><input data-journal-detail value="${escapeAttr(item.detail || item.subtitle || '')}" placeholder="Qué ha ocurrido"></label>
      <label class="item-detail-form__toggle"><input type="checkbox" data-activity-note-toggle ${checked}><span><strong>Añadir una anotación</strong><small>Comentario e imagen opcionales para el diario.</small></span></label>
      <div class="item-detail-form__optional" data-activity-note-fields ${checked ? '' : 'hidden'}>${journalComposerMarkup({})}</div>
      <footer class="item-detail-form__actions"><button type="button" class="item-detail-control item-detail-control--quiet" data-detail-action="subview-back">Cancelar</button>${(item.grill?.hot || item.grill?.charred || item.states?.charred) ? '<button type="button" class="item-detail-control item-detail-control--danger-quiet" data-detail-action="grill-turn">Dar la vuelta</button>' : ''}<button type="button" class="item-detail-control item-detail-control--primary" data-detail-action="activity-save">Guardar actividad</button></footer>
    </form>`;
    renderInfoSubview(root, subviewMarkup(journalOnly ? 'Nueva entrada' : 'Actualizar actividad', body, { eyebrow: journalOnly ? 'Diario' : item.title || '' }));
    root.__composerGetter = await setupJournalComposer(root.querySelector('[data-activity-form]'));
  }
  async function showAssessmentForm(root) {
    const rating = Math.max(0, Math.min(5, Number(item.rating) || 0));
    const body = `<form class="item-detail-form item-detail-assessment" data-assessment-form>
      <section class="assessment-rating"><span>Calificación</span><div class="assessment-stars">${[1,2,3,4,5].map(n => `<label><input type="radio" name="assessment-rating" value="${n}" ${rating === n ? 'checked' : ''}><span>${n <= rating ? '★' : '☆'}</span></label>`).join('')}<button type="button" data-assessment-clear>Sin calificación</button></div></section>
      <label class="assessment-completed"><input type="checkbox" data-assessment-completed ${isInCollection(item, currentContext) ? 'checked' : ''}><span><strong>Terminado</strong><small>Incluye el item en Colección.</small></span></label>
      <section class="assessment-review"><span>Review opcional</span>${journalComposerMarkup({ comment: item.review?.comment || '', image: item.review?.image || '' })}</section>
      <footer class="item-detail-form__actions"><button type="button" class="item-detail-control item-detail-control--quiet" data-detail-action="subview-back">Cancelar</button><button type="button" class="item-detail-control item-detail-control--primary" data-detail-action="assessment-save">Guardar</button></footer>
    </form>`;
    renderInfoSubview(root, subviewMarkup('Valoración', body, { eyebrow: item.title || '' }));
    root.__composerGetter = await setupJournalComposer(root.querySelector('[data-assessment-form]'));
    root.querySelector('[data-assessment-clear]')?.addEventListener('click', () => { root.querySelectorAll('input[name="assessment-rating"]').forEach(input => { input.checked = false; }); root.querySelectorAll('.assessment-stars label span').forEach(span => { span.textContent = '☆'; }); });
    root.querySelectorAll('input[name="assessment-rating"]').forEach(input => input.addEventListener('change', () => { const value=Number(input.value); root.querySelectorAll('.assessment-stars label span').forEach((span,index)=>{span.textContent=index<value?'★':'☆';}); }));
  }
  async function saveAssessment(root) {
    const wasCompleted = isInCollection(item, currentContext);
    const value = root.__composerGetter?.() || {};
    const ratingInput = root.querySelector('input[name="assessment-rating"]:checked');
    const payload = { rating: ratingInput ? Number(ratingInput.value) : null, completed: root.querySelector('[data-assessment-completed]')?.checked === true, reviewComment: value.comment, reviewImageData: value.imageData, reviewRemoveImage: value.removeImage };
    const response = await api(`/api/items/${encodeURIComponent(item.canonicalId || item.id)}/assessment`, { method:'PUT', body:JSON.stringify(payload) });
    mergeReturnedItem(response);
    item.review = response.review || null; item.journalCount = response.journalCount ?? item.journalCount; item.latestJournalEntry = response.latestJournalEntry ?? item.latestJournalEntry;
    onItemUpdated({ ...item }); toast(payload.completed ? 'Guardado en Colección' : 'Valoración actualizada');
    if (payload.completed && !wasCompleted) { followItem(root, 'collections'); return; }
    renderBody(root);
  }
  async function showReviewForm(root) {
    const body = `<form class="item-detail-form" data-review-form>${journalComposerMarkup({ comment: item.review?.comment || '', image: item.review?.image || '' })}<footer class="item-detail-form__actions"><button type="button" class="item-detail-control item-detail-control--quiet" data-detail-action="subview-back">Cancelar</button>${item.review ? '<button type="button" class="item-detail-control item-detail-control--danger-quiet" data-detail-action="review-delete">Eliminar review</button>' : ''}<button type="button" class="item-detail-control item-detail-control--primary" data-detail-action="review-save">Guardar review</button></footer></form>`;
    renderInfoSubview(root, subviewMarkup(item.review ? 'Editar review' : 'Escribir review', body, { eyebrow: 'Valoración' }));
    root.__composerGetter = await setupJournalComposer(root.querySelector('[data-review-form]'));
  }
  async function saveActivity(root) {
    const value = root.__composerGetter?.() || {};
    const wantsNote = Boolean(root.querySelector('[data-activity-note-toggle]')?.checked);
    const payload = { detail: root.querySelector('[data-journal-detail]')?.value || item.detail || item.subtitle || '', comment: wantsNote ? value.comment : '', imageData: wantsNote ? value.imageData : '', removeImage: false };
    const response = await api(`/api/items/${encodeURIComponent(item.canonicalId || item.id)}/activity`, { method: 'POST', body: JSON.stringify(payload) });
    mergeReturnedItem(response);
    Object.assign(item, {
      journalCount: response.journalCount,
      latestJournalEntry: response.latestJournalEntry,
      review: response.review,
      states: { ...(item.states || {}), charred: false },
      grill: { ...(item.grill || {}), charred: false, hot: false, overdue: false }
    });
    toast(wantsNote && (payload.comment || payload.imageData) ? 'Actividad y diario actualizados' : 'Actividad actualizada');
    onItemUpdated({ ...item });
    followItem(root, currentContext || 'database', 'turned');
  }
  async function saveReview(root) {
    const value = root.__composerGetter?.() || {};
    const response = await api(`/api/items/${encodeURIComponent(item.canonicalId || item.id)}/review`, { method: 'PUT', body: JSON.stringify(value) });
    Object.assign(item, { review: response.review, journalCount: response.journalCount, latestJournalEntry: response.latestJournalEntry });
    onItemUpdated({ ...item }); renderBody(root); toast('Review guardada');
  }
  async function showJournal(root, page = 1) {
    const response = await api(`/api/items/${encodeURIComponent(item.canonicalId || item.id)}/journal?page=${page}&limit=8`);
    item.review = response.review || null; item.journalCount = response.total || 0; item.latestJournalEntry = response.items?.[0] || null;
    root.__journalPage = response.page; root.__journalEntries = response.items || [];
    const entries = response.items || [];
    const timeline = entries.length ? entries.map(entry => { const d = new Date(entry.activityAt || entry.createdAt); return `<article class="journal-entry" data-entry-id="${escapeAttr(entry.id)}"><div class="journal-entry__date"><strong>${String(d.getDate()).padStart(2,'0')}</strong><span>${d.toLocaleDateString('es-ES',{month:'short'})}</span><small>${d.getFullYear()}</small></div><div class="journal-entry__body">${entry.comment ? `<p>${escapeHtml(entry.comment)}</p>` : ''}${entry.image ? `<button class="journal-entry__image" data-journal-image="${escapeAttr(entry.image)}"><img src="${escapeAttr(entry.image)}" alt=""></button>` : ''}<div class="journal-entry__actions"><button data-detail-action="journal-edit" data-entry-id="${escapeAttr(entry.id)}">Editar</button><button class="is-danger" data-detail-action="journal-delete" data-entry-id="${escapeAttr(entry.id)}">Eliminar</button></div></div></article>`; }).join('') : `<div class="journal-empty"><span aria-hidden="true">✎</span><strong>Tu diario está vacío</strong><p>Actualiza la actividad del item y añade una anotación cuando quieras recordar algo.</p><button type="button" class="item-detail-control item-detail-control--primary" data-detail-action="journal-new">Crear primera entrada</button></div>`;
    const pagination = response.pages > 1 ? `<nav class="journal-pagination" aria-label="Paginación del diario"><button data-detail-action="journal-page" data-page="${response.page-1}" ${response.page<=1?'disabled':''} aria-label="Página anterior">‹</button><strong>${response.page} / ${response.pages}</strong><button data-detail-action="journal-page" data-page="${response.page+1}" ${response.page>=response.pages?'disabled':''} aria-label="Página siguiente">›</button></nav>` : '';
    const content = `<div class="journal-view__toolbar"><div><span>${response.total} ${response.total === 1 ? 'entrada' : 'entradas'}</span></div><button type="button" class="item-detail-control item-detail-control--primary item-detail-control--compact" data-detail-action="journal-new">＋ Nueva entrada</button></div><div class="journal-timeline">${timeline}</div>${pagination}`;
    renderInfoSubview(root, subviewMarkup('Diario', content, { panelClass: 'item-detail-subview--journal' }));
  }

  async function runAction(root, action, trigger = null) {
    if (!action || busy) return;
    if (action === 'groups') { await refreshGroups(); renderInlineGroupPicker(root); return; }
    if (action === 'groups-cancel') { const picker = root.querySelector('[data-detail-group-picker]'); if (picker) { picker.hidden = true; picker.innerHTML = ''; } return; }
    if (action === 'groups-save') { await saveInlineGroups(root); return; }
    if (action === 'menu') { const menu = root.querySelector('[data-detail-more-menu]'); if (menu) menu.hidden = !menu.hidden; return; }
    if (action === 'edit') { await editItem(root); return; }
    if (action === 'edit-manual-data') { await editManualData(root); return; }
    if (action === 'activity') { await showActivityForm(root); return; }
    if (action === 'activity-save') { await saveActivity(root); return; }
    if (action === 'subview-back') { renderBody(root); return; }
    if (action === 'journal') { await showJournal(root, 1); return; }
    if (action === 'journal-back') { renderBody(root); return; }
    if (action === 'journal-page') { const page = Number(trigger?.dataset.page || root.__journalPage || 1); await showJournal(root, page); return; }
    if (action === 'journal-new') { await showActivityForm(root, { journalOnly: true }); return; }
    if (action === 'assessment') { await showAssessmentForm(root); return; }
    if (action === 'assessment-save') { await saveAssessment(root); return; }
    if (action === 'review-edit') { await showReviewForm(root); return; }
    if (action === 'review-save') { await saveReview(root); return; }
    if (action === 'review-delete') { if (await ui.confirm({ title:'Eliminar review', message:'La calificación no cambiará.', confirmText:'Eliminar', danger:true })) { const response = await api(`/api/items/${encodeURIComponent(item.canonicalId||item.id)}/review`, { method:'DELETE' }); item.review=null; item.journalCount=response.journalCount ?? item.journalCount; item.latestJournalEntry=response.latestJournalEntry ?? item.latestJournalEntry; onItemUpdated({...item}); renderBody(root); toast('Review eliminada'); } return; }
    if (action === 'journal-edit') { const entry = (root.__journalEntries||[]).find(e => e.id === trigger?.dataset.entryId); if (!entry) return; const body = `<form class="item-detail-form" data-entry-edit-form>${journalComposerMarkup({ comment: entry.comment || '', image: entry.image || '' })}<footer class="item-detail-form__actions"><button type="button" class="item-detail-control item-detail-control--quiet" data-detail-action="journal">Cancelar</button><button type="button" class="item-detail-control item-detail-control--primary" data-detail-action="journal-edit-save" data-entry-id="${escapeAttr(entry.id)}">Guardar cambios</button></footer></form>`; renderInfoSubview(root, subviewMarkup('Editar entrada', body, { eyebrow:'Diario' })); root.__composerGetter = await setupJournalComposer(root.querySelector('[data-entry-edit-form]')); return; }
    if (action === 'journal-edit-save') { const value=root.__composerGetter?.()||{}; await api(`/api/items/${encodeURIComponent(item.canonicalId||item.id)}/journal/${encodeURIComponent(trigger?.dataset.entryId)}`,{method:'PATCH',body:JSON.stringify(value)}); await showJournal(root,root.__journalPage||1); onItemUpdated({...item}); toast('Entrada actualizada'); return; }
    if (action === 'journal-delete') { const button = trigger; const id=button?.dataset.entryId; if(id && await ui.confirm({title:'Eliminar entrada',message:'Esta acción no cambiará la fecha de actividad.',confirmText:'Eliminar',danger:true})){await api(`/api/items/${encodeURIComponent(item.canonicalId||item.id)}/journal/${encodeURIComponent(id)}`,{method:'DELETE'});await showJournal(root,root.__journalPage||1);onItemUpdated({...item});} return; }
    busy = true;
    try {
      const canonical = encodeURIComponent(item.canonicalId || item.id);
      if (action === 'grill-turn') { const response = await api(`/api/items/${canonical}/grill/turn`, { method: 'POST' }); mergeReturnedItem(response); item.lastActivityAt = response?.item?.lastActivityAt || response?.lastActivityAt || new Date().toISOString(); item.states = { ...(item.states || {}), charred: false }; item.grill = { ...(item.grill || {}), charred: false, hot: false, overdue: false }; onItemUpdated({ ...item }); toast('Se le ha dado la vuelta al item'); renderBody(root); return; }
      if (action === 'toggle-backlog') {
        if (isInBacklog(item, currentContext)) { await api(`/api/items/${canonical}/backlog`, { method: 'DELETE' }); item.states = { ...(item.states || {}), inBacklog: false }; item.status = 'known'; item.lastActivityAt = new Date().toISOString(); onItemUpdated({ ...item }); toast('Quitado del Backlog'); followItem(root, 'database'); }
        else { const response = await api(`/api/items/${canonical}/backlog`, { method: 'POST' }); mergeReturnedItem(response); item.states = { ...(item.states || {}), inBacklog: true, inOnDeck: false, completed: false }; item.completedAt = null; item.status = 'backlog'; onItemUpdated({ ...item }); toast('Movido a Backlog'); followItem(root, 'backlog'); }
        return;
      }
      if (action === 'toggle-deck') {
        if (isInDeck(item, currentContext)) { await api(`/api/items/${canonical}/deck`, { method: 'DELETE' }); item.states = { ...(item.states || {}), inOnDeck: false }; item.status = 'known'; item.lastActivityAt = new Date().toISOString(); onItemUpdated({ ...item }); toast('Quitado de On Deck'); followItem(root, 'database'); return; }
        const response = await postDeckWithReplacement(`/api/items/${canonical}/deck`); if (!response) return; mergeReturnedItem(response); item.states = { ...(item.states || {}), inOnDeck: true, inBacklog: false, completed: false }; item.completedAt = null; item.status = 'on-deck'; onItemUpdated({ ...item }); toast('Movido a On Deck'); followItem(root, 'on-deck'); return;
      }
      if (action === 'remove-collection') { const ok = await ui.confirm({ title: 'Quitar de Colección', message: 'Se retirará la calificación/finalización, pero el item seguirá en Base de datos.', confirmText: 'Quitar' }); if (!ok) return; const response = await api(`/api/items/${canonical}/collection`, { method: 'DELETE' }); mergeReturnedItem(response); item.rating = null; item.completedAt = null; item.states = { ...(item.states || {}), completed: false, inBacklog: false, inOnDeck: false }; item.status = 'known'; item.lastActivityAt = response?.item?.lastActivityAt || item.lastActivityAt || new Date().toISOString(); if (currentContext === 'collections') currentContext = 'database'; onItemUpdated({ ...item }); toast('Quitado de Colección'); followItem(root, 'database'); return; }
      if (action === 'delete-permanent') { const ok = await ui.confirm({ title: 'Eliminar definitivamente', message: 'Esto eliminará el item de la base de datos, Backlog, On Deck, Colección, grupos y assets locales asociados. ¿Continuar?', confirmText: 'Eliminar definitivamente', danger: true }); if (!ok) return; await api(`/api/items/${canonical}/delete`, { method: 'POST' }); currentContext = 'removed'; toast('Item eliminado definitivamente'); renderBody(root); return; }
    } finally { busy = false; }
  }
  return new Promise(resolve => {
    ui.open({ title: labels.title || '', className: `ui-modal-root--item-detail ${item.states?.charred || item.grill?.charred ? 'is-charred' : item.grill?.hot ? 'is-hot' : ''}`, body: bodyMarkup(item, currentContext, collectionGroups, settings), actions: [] }).then(value => { try { if (window.location.hash.startsWith('#/item/')) window.history.replaceState(null, '', previousHash || '#/database'); } catch {} resolve(value); });
    requestAnimationFrame(() => { const root = document.querySelector('.ui-modal-root--item-detail'); if (!root) return; if (root.__itemDetailAbort) root.__itemDetailAbort.abort(); root.__itemDetailAbort = new AbortController(); root.addEventListener('click', async event => { if (event.target.closest('.ui-modal__x')) { try { window.history.replaceState(null, '', previousHash && !previousHash.startsWith('#/item/') ? previousHash : '#/database'); } catch {} } const journalImage = event.target.closest('[data-journal-image]'); if (journalImage) { await openImagePopup(journalImage.dataset.journalImage); return; } const rateButton = event.target.closest('[data-item-rate]'); if (rateButton) { if (busy) return; busy = true; try { const rating = Number(rateButton.dataset.itemRate || 0); const result = await applyRating({ ui, api, item, context: currentContext, rating, toast }); if (result) { onItemUpdated({ ...item }); followItem(root, 'collections'); } } finally { busy = false; } return; } const noteToggle = event.target.closest('[data-activity-note-toggle]'); if (noteToggle) { const fields=root.querySelector('[data-activity-note-fields]'); if(fields) fields.hidden=!noteToggle.checked; return; } const actionButton = event.target.closest('[data-detail-action]'); if (actionButton) await runAction(root, actionButton.dataset.detailAction, actionButton); }, { signal: root.__itemDetailAbort.signal }); root.addEventListener('keydown', async event => { const activator = event.target.closest('.item-detail__note--clickable[data-detail-action]'); if (!activator) return; if (event.key !== 'Enter' && event.key !== ' ') return; event.preventDefault(); await runAction(root, activator.dataset.detailAction, activator); }, { signal: root.__itemDetailAbort.signal }); });
  });
}
