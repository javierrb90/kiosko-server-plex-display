import { openItemDetail } from '../core/item-detail.js';
import { escapeHtml, escapeAttr, clamp, typeFor, searchHaystack, itemMatchesGroup, backdropFor } from '../core/item-utils.js';
import { itemCardMarkup, itemListMarkup, activeFilterChipsMarkup, paginationMarkup } from '../core/item-renderer.js';

const TYPE_LABELS = { games: 'Juegos', movies: 'Películas', series: 'Series' };
const STATUS_LABELS = { '': 'Todos', known: 'Base', backlog: 'Backlog', 'on-deck': 'On Deck', completed: 'Colecciones' };
const SIZE_MAP = { small: { width: 250, gap: 12, poster: 82, simpleWidth: 150, mobileColumns: 4 }, medium: { width: 330, gap: 16, poster: 112, simpleWidth: 190, mobileColumns: 3 }, large: { width: 430, gap: 20, poster: 150, simpleWidth: 240, mobileColumns: 2 } };
const BASE_TYPES = [
  { id: 'games', singular: 'Juego', plural: 'Juegos' },
  { id: 'movies', singular: 'Película', plural: 'Películas' },
  { id: 'series', singular: 'Serie', plural: 'Series' }
];
function customTypesFromSettings(settings = {}) {
  const rows = Array.isArray(settings.itemTypes) ? settings.itemTypes : [];
  const seen = new Set(BASE_TYPES.map(type => type.id));
  return [...BASE_TYPES, ...rows.filter(type => type?.id && !seen.has(type.id) && seen.add(type.id)).map(type => ({ id: type.id, singular: type.singular || type.label || type.id, plural: type.plural || type.label || type.singular || type.id }))];
}
function typePluralLabel(type, settings = {}) {
  return customTypesFromSettings(settings).find(row => row.id === type)?.plural || TYPE_LABELS[type] || String(type || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function manualTypeOptions(settings = {}, current = 'movies') {
  return customTypesFromSettings(settings).map(type => `<option value="${escapeAttr(type.id)}" ${type.id === current ? 'selected' : ''}>${escapeHtml(type.singular || type.plural || type.id)}</option>`).join('');
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


export function createItemSegmentView({ id, title, view = 'database', api, ui, controlsRoot, defaultSort = 'lastActivityAt', allowStatus = false, groupByDate = false, defaultLimit = 24 } = {}) {
  let el;
  let allItems = [];
  let visibleItems = [];
  let page = 1;
  let limit = defaultLimit;
  let pages = 1;
  let total = 0;
  let search = '';
  let activeTypes = new Set(['games','movies','series']);
  let activeGroupIds = new Set();
  let groupMatch = 'any';
  let source = '';
  let status = '';
  let sort = defaultSort;
  let direction = 'desc';
  let viewMode = 'grid';
  let cardSize = 'medium';
  let cardFormat = 'standard';
  let includeCharred = false;
  let charredOnly = false;
  let isVisible = false;
  let controlsMounted = false;
  let collectionGroups = [];
  let settings = {};
  let loadingSeq = 0;

  function sessionKey() { return `kiosko:v6.8:${id}`; }
  function saveSession() {
    try { localStorage.setItem(sessionKey(), JSON.stringify({ search, activeTypes: [...activeTypes], activeGroupIds: [...activeGroupIds], groupMatch, source, status, sort, direction, viewMode, cardSize, cardFormat, includeCharred, limit })); } catch {}
  }
  function loadSession() {
    try {
      const incomingSearch = id === 'database' ? localStorage.getItem('bbqueue:database-search') : '';
      const parsed = JSON.parse(localStorage.getItem(sessionKey()) || 'null');
      if (!parsed) { if (incomingSearch) { search = incomingSearch; localStorage.removeItem('bbqueue:database-search'); sessionStorage.setItem('bbqueue:focus-database-search', '1'); } return; }
      if (typeof parsed.search === 'string') search = parsed.search;
      if (Array.isArray(parsed.activeTypes)) activeTypes = new Set(parsed.activeTypes.filter(Boolean));
      if (Array.isArray(parsed.activeGroupIds)) activeGroupIds = new Set(parsed.activeGroupIds);
      if (['any','all'].includes(parsed.groupMatch)) groupMatch = parsed.groupMatch;
      if (typeof parsed.source === 'string') source = parsed.source;
      if (typeof parsed.status === 'string') status = parsed.status;
      if (['lastActivityAt','firstSeenAt','updatedAt','title','source','collectionType','rating','completedAt'].includes(parsed.sort)) sort = parsed.sort;
      if (['asc','desc'].includes(parsed.direction)) direction = parsed.direction;
      if (['grid','list'].includes(parsed.viewMode)) viewMode = parsed.viewMode;
      if (['small','medium','large'].includes(parsed.cardSize)) cardSize = parsed.cardSize;
      if (parsed.cardFormat === 'compact') cardFormat = 'simple';
      else if (parsed.cardFormat === 'expanded') cardFormat = 'standard';
      else if (['simple','standard'].includes(parsed.cardFormat)) cardFormat = parsed.cardFormat;
      if (typeof parsed.includeCharred === 'boolean') includeCharred = parsed.includeCharred;
      limit = clamp(parsed.limit, 6, 500, defaultLimit);
      if (incomingSearch) { search = incomingSearch; localStorage.removeItem('bbqueue:database-search'); sessionStorage.setItem('bbqueue:focus-database-search', '1'); }
    } catch {}
  }
  function availableTypes() {
    const ids = customTypesFromSettings(settings).map(type => type.id);
    for (const item of allItems) if (item?.collectionType && !ids.includes(item.collectionType)) ids.push(item.collectionType);
    return ids;
  }
  function ensureActiveTypes() {
    const ids = availableTypes();
    if (!activeTypes.size || [...activeTypes].some(type => !ids.includes(type))) activeTypes = new Set(ids);
  }
  function currentSize() { return cardSize || settings?.views?.[id]?.cardSize || 'medium'; }
  function queryUrl() {
    const params = new URLSearchParams({ view, page: '1', limit: '5000', sort, direction, sync: '1' });
    return `/api/items?${params.toString()}`;
  }
  function itemMatchesGroups(item) {
    if (!activeGroupIds.size) return true;
    const selected = collectionGroups.filter(group => activeGroupIds.has(group.id));
    if (!selected.length) return true;
    const checks = selected.map(group => itemMatchesGroup(item, group));
    return groupMatch === 'all' ? checks.every(Boolean) : checks.some(Boolean);
  }
  function applyFilters() {
    ensureActiveTypes();
    const q = search.trim().toLowerCase();
    let rows = [...allItems]
      .filter(item => activeTypes.has(typeFor(item)))
      .filter(item => id !== "database" ? true : (charredOnly ? Boolean(item.states?.charred) : (includeCharred || !item.states?.charred)))
      .filter(item => !source || item.source === source)
      .filter(item => !allowStatus || !status || item.status === status || item.states?.[status] === true)
      .filter(item => !q || searchHaystack(item).includes(q))
      .filter(itemMatchesGroups);
    rows.sort((a, b) => {
      const dir = direction === 'asc' ? 1 : -1;
      const av = a[sort] ?? '';
      const bv = b[sort] ?? '';
      if (sort === 'rating') return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    total = rows.length;
    pages = Math.max(1, Math.ceil(total / limit));
    page = Math.max(1, Math.min(page, pages));
    visibleItems = rows.slice((page - 1) * limit, page * limit);
  }
  function groupRowsMarkup(rows = []) {
    if (!groupByDate) return viewMode === 'list' ? itemListMarkup(rows, { context: id, groups: collectionGroups }) : rows.map(item => itemCardMarkup(item, { context: id, groups: collectionGroups, format: cardFormat, visibility: settings?.design?.gridCards?.[cardFormat] || {} })).join('');
    const today = new Date(); today.setHours(0,0,0,0);
    const one = 86400000;
    const labelFor = item => {
      const t = Date.parse(item.lastActivityAt || item.updatedAt || item.createdAt || '');
      if (!Number.isFinite(t)) return 'ANTERIOR';
      if (t >= today.getTime()) return 'HOY';
      if (t >= today.getTime() - one) return 'AYER';
      if (t >= today.getTime() - one * 7) return 'ÚLTIMA SEMANA';
      return 'ANTERIOR';
    };
    let last = '';
    return rows.map(item => {
      const label = labelFor(item);
      const heading = label !== last ? `<div class="media-date-heading">${escapeHtml(label)}</div>` : '';
      last = label;
      return `${heading}${itemCardMarkup(item, { context: id, groups: collectionGroups, format: cardFormat, visibility: settings?.design?.gridCards?.[cardFormat] || {} })}`;
    }).join('');
  }
  async function load({ resetPage = false } = {}) {
    const seq = ++loadingSeq;
    if (resetPage) page = 1;
    try {
      const result = await api(queryUrl());
      if (seq !== loadingSeq) return;
      allItems = result.items || [];
      applyFilters();
      saveSession();
    } catch (error) {
      ui.toast(`No se pudo cargar ${title}`, { detail: error.message || '' });
    } finally {
      if (seq === loadingSeq) render();
    }
  }
  function renderControls({ force = false } = {}) {
    if (!controlsRoot || !isVisible) return;
    if (!force && controlsMounted) return;
    controlsMounted = true;
    controlsRoot.innerHTML = `<div class="collection-toolbar"><label class="collection-search"><input type="search" data-quick-search value="${escapeAttr(search)}" placeholder="Buscar en Base de datos" autocomplete="off"></label><button type="button" class="view-actions-button view-filter-button view-mode-icon" data-toggle-view title="${viewMode === 'grid' ? 'Ver como lista' : 'Ver como cuadrícula'}" aria-label="${viewMode === 'grid' ? 'Ver como lista' : 'Ver como cuadrícula'}">${viewMode === 'grid' ? '<svg viewBox="0 0 24 24"><path d="M4 5h16v2H4zm0 6h16v2H4zm0 6h16v2H4z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z"/></svg>'}</button><button type="button" class="view-actions-button view-filter-button" data-open-controls title="Configurar espacio de trabajo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17.25V20h2.75L17.81 8.94l-2.75-2.75L4 17.25Zm15.71-10.04a1.003 1.003 0 0 0 0-1.42l-1.5-1.5a1.003 1.003 0 0 0-1.42 0l-1.17 1.17 2.75 2.75 1.34-1Z"/></svg><span class="view-filter-button__label">Configurar</span><span class="view-filter-button__meta" data-filter-meta></span></button></div>`;
    controlsRoot.querySelector('[data-quick-search]')?.addEventListener('input', event => { const value = event.target.value || ''; if (id !== 'database' && value) { try { localStorage.setItem('bbqueue:database-search', value); sessionStorage.setItem('bbqueue:focus-database-search', '1'); } catch {} window.location.hash = '#/database'; return; } search = value; page = 1; applyFilters(); render(); saveSession(); });
    if (id === 'database' && sessionStorage.getItem('bbqueue:focus-database-search') === '1') { sessionStorage.removeItem('bbqueue:focus-database-search'); requestAnimationFrame(() => { const input = controlsRoot.querySelector('[data-quick-search]'); input?.focus(); input?.setSelectionRange(input.value.length, input.value.length); }); }
    controlsRoot.querySelector('[data-toggle-view]')?.addEventListener('click', () => { viewMode = viewMode === 'grid' ? 'list' : 'grid'; renderControls({ force: true }); render(); saveSession(); });
    controlsRoot.querySelector('[data-open-controls]')?.addEventListener('click', openControlsModal);
    updateControlsState();
  }
  function updateControlsState() {
    const meta = controlsRoot?.querySelector('[data-filter-meta]');
    if (meta) meta.textContent = `${activeTypes.size}/${availableTypes().length} · ${activeGroupIds.size ? activeGroupIds.size + ' grupos · ' : ''}${viewMode === 'grid' ? currentSize().slice(0,1).toUpperCase() : 'Lista'} · ${limit}`;
  }
  async function openControlsModal() {
    const body = `<div class="controls-modal workspace-controls">
      <section class="controls-modal__section controls-modal__section--mobile-search"><h3>Búsqueda</h3><label class="ui-field"><span>Buscar</span><input type="search" data-control-search value="${escapeAttr(search)}" placeholder="Buscar"></label></section>
      <section class="controls-modal__section workspace-controls__section"><div class="workspace-controls__heading"><span>Contenido</span><h3>Tipos visibles</h3><p>Elige qué clases de elementos aparecen en este espacio.</p></div><div class="controls-modal__checks">${availableTypes().map(type => `<label class="controls-modal__toggle"><input type="checkbox" data-filter-type="${escapeAttr(type)}" ${activeTypes.has(type) ? 'checked' : ''}><span>${escapeHtml(typePluralLabel(type, settings))}</span></label>`).join('')}</div></section>
      <section class="controls-modal__section workspace-controls__section"><div class="workspace-controls__heading"><span>Contenido</span><h3>Grupos</h3><p>Filtra por uno o varios grupos.</p></div><div class="segmented-control"><label><input type="radio" name="group-match" value="any" ${groupMatch === 'any' ? 'checked' : ''}><span>Cualquiera</span></label><label><input type="radio" name="group-match" value="all" ${groupMatch === 'all' ? 'checked' : ''}><span>Todos</span></label></div><div class="controls-modal__checks">${collectionGroups.length ? collectionGroups.map(group => `<label class="controls-modal__toggle"><input type="checkbox" data-filter-group="${escapeAttr(group.id)}" ${activeGroupIds.has(group.id) ? 'checked' : ''}><span>${escapeHtml(group.name)}</span><small>${escapeHtml(group.mode || 'manual')}</small></label>`).join('') : '<p class="settings-help">No hay grupos creados.</p>'}</div></section>
      ${allowStatus ? `<section class="controls-modal__section workspace-controls__section"><div class="workspace-controls__heading"><span>Contenido</span><h3>Estado y fuente</h3><p>Acota los resultados por situación o procedencia.</p></div><label class="ui-field"><span>Estado</span><select data-control-status>${Object.entries(STATUS_LABELS).map(([value,label]) => `<option value="${escapeAttr(value)}" ${status === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label><label class="ui-field"><span>Fuente</span><input data-control-source value="${escapeAttr(source)}" placeholder="plex, playnite..."></label></section>` : `<section class="controls-modal__section workspace-controls__section"><div class="workspace-controls__heading"><span>Contenido</span><h3>Fuente</h3></div><label class="ui-field"><span>Fuente</span><input data-control-source value="${escapeAttr(source)}" placeholder="plex, playnite..."></label></section>`}
      <section class="controls-modal__section workspace-controls__section"><div class="workspace-controls__heading"><span>Presentación</span><h3>Diseño</h3><p>Configura cómo se muestran los elementos.</p></div><div class="segmented-control"><label><input type="radio" name="view-mode" value="grid" ${viewMode === 'grid' ? 'checked' : ''}><span>Grid</span></label><label><input type="radio" name="view-mode" value="list" ${viewMode === 'list' ? 'checked' : ''}><span>Lista</span></label></div><div class="controls-modal__sizes">${[['small','Pequeño'],['medium','Mediano'],['large','Grande']].map(([value,label]) => `<label class="controls-modal__toggle"><input type="radio" name="size" value="${value}" ${currentSize() === value ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div><div class="workspace-format-picker"><strong>Diseño de tarjeta</strong><div class="segmented-control"><label><input type="radio" name="card-format" value="simple" ${cardFormat === 'simple' ? 'checked' : ''}><span>Simple</span></label><label><input type="radio" name="card-format" value="standard" ${cardFormat === 'standard' ? 'checked' : ''}><span>Normal</span></label></div></div>${id === 'database' ? `<label class="controls-modal__toggle"><input type="checkbox" data-include-charred ${includeCharred ? 'checked' : ''}><span>Incluir achicharrados por defecto</span></label>` : ''}<label class="ui-field"><span>Items por página</span><input data-items-per-page type="number" min="6" max="500" value="${escapeAttr(limit)}"></label></section>
      <section class="controls-modal__section workspace-controls__section"><div class="workspace-controls__heading"><span>Presentación</span><h3>Orden</h3></div><label class="ui-field"><span>Ordenar por</span><select data-control-sort>${[['lastActivityAt','Última actividad'],['firstSeenAt','Entrada en BD'],['updatedAt','Actualización'],['title','Título'],['rating','Rating'],['completedAt','Completado']].map(([value,label]) => `<option value="${value}" ${sort === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><div class="segmented-control"><label><input type="radio" name="direction" value="desc" ${direction === 'desc' ? 'checked' : ''}><span>Desc</span></label><label><input type="radio" name="direction" value="asc" ${direction === 'asc' ? 'checked' : ''}><span>Asc</span></label></div></section>
    </div>`;
    const result = await ui.open({ title: `${title} · espacio de trabajo`, className: 'ui-modal-root--workspace', body, actions: [{ label: 'Cancelar', value: null }, { label: 'Aplicar', variant: 'primary', onClick: root => ({ search: root.querySelector('[data-control-search]')?.value || search, activeTypes: [...root.querySelectorAll('[data-filter-type]:checked')].map(input => input.dataset.filterType), activeGroupIds: [...root.querySelectorAll('[data-filter-group]:checked')].map(input => input.dataset.filterGroup), groupMatch: root.querySelector('input[name="group-match"]:checked')?.value || groupMatch, source: root.querySelector('[data-control-source]')?.value.trim() || '', status: root.querySelector('[data-control-status]')?.value || '', viewMode: root.querySelector('input[name="view-mode"]:checked')?.value || viewMode, cardSize: root.querySelector('input[name="size"]:checked')?.value || cardSize, cardFormat: root.querySelector('input[name="card-format"]:checked')?.value || cardFormat, includeCharred: root.querySelector('[data-include-charred]')?.checked === true, limit: clamp(root.querySelector('[data-items-per-page]')?.value, 6, 500, limit), sort: root.querySelector('[data-control-sort]')?.value || sort, direction: root.querySelector('input[name="direction"]:checked')?.value || direction }) }] });
    if (!result) return;
    search = result.search;
    activeTypes = new Set((result.activeTypes || []).filter(Boolean));
    activeGroupIds = new Set(result.activeGroupIds || []);
    groupMatch = ['any','all'].includes(result.groupMatch) ? result.groupMatch : 'any';
    source = result.source;
    status = result.status;
    viewMode = result.viewMode;
    cardSize = result.cardSize;
    cardFormat = result.cardFormat;
    includeCharred = result.includeCharred;
    limit = result.limit;
    sort = result.sort;
    direction = result.direction;
    page = 1;
    applyFilters();
    renderControls({ force: true });
    render();
    saveSession();
  }
  async function openCreateManualItem() {
    if (id !== 'database') return;
    const result = await ui.open({
      title: 'Nuevo item',
      className: 'ui-modal-root--wide',
      body: `<div class="manual-item-form">
        <div class="manual-item-preview">
          <div class="manual-item-preview__backdrop"></div>
          <div class="manual-item-preview__poster"><span>+</span></div>
          <div><strong>Nuevo item</strong><small>Creado en Kiosko</small></div>
        </div>
        <label class="ui-field"><span>Título</span><input data-manual-title placeholder="Título" required></label>
        <label class="ui-field"><span>Estado / detalle</span><input data-manual-detail placeholder="Detalle visible, estado, nota..."></label>
        <label class="ui-field"><span>Tipo</span><select data-manual-type>${manualTypeOptions(settings, "movies")}</select></label>
        <label class="ui-field"><span>Carátula URL / asset <em>obligatoria</em></span><input data-manual-poster placeholder="https://... o /assets/..."></label>
        <label class="ui-field"><span>Subir carátula</span><input type="file" accept="image/*" data-manual-poster-file></label>
        <label class="ui-field"><span>Backdrop URL / asset</span><input data-manual-backdrop placeholder="https://... o /assets/..."></label>
        <label class="ui-field"><span>Subir backdrop</span><input type="file" accept="image/*" data-manual-backdrop-file></label>
      </div>`,
      actions: [
        { label: 'Cancelar', value: null },
        { label: 'Crear item', variant: 'primary', onClick: async modal => {
          const title = modal.querySelector('[data-manual-title]')?.value?.trim();
          if (!title) return false;
          const posterFile = modal.querySelector('[data-manual-poster-file]')?.files?.[0];
          const backdropFile = modal.querySelector('[data-manual-backdrop-file]')?.files?.[0];
          const posterUrl = modal.querySelector('[data-manual-poster]')?.value?.trim() || '';
          if (!posterFile && !posterUrl) { ui.toast('La carátula es obligatoria'); return false; }
          return {
            title,
            detail: modal.querySelector('[data-manual-detail]')?.value || '',
            collectionType: modal.querySelector('[data-manual-type]')?.value || 'movies',
            poster: posterUrl,
            backdrop: modal.querySelector('[data-manual-backdrop]')?.value || '',
            posterAsset: await fileToDataUri(posterFile),
            backdropAsset: await fileToDataUri(backdropFile)
          };
        }}
      ]
    });
    if (!result) return;
    const response = await api('/api/items', { method: 'POST', body: JSON.stringify(result) });
    ui.toast('Item creado');
    await load({ resetPage: true });
    const created = response?.item;
    if (created) await openItem(created);
  }

  function render() {
    if (!el || !isVisible) return;
    applyFilters();
    const charredCount = allItems.filter(item => item.states?.charred).length;
    const charredButton = el.querySelector('[data-toggle-charred]'); if (charredButton) { charredButton.hidden = !charredCount; charredButton.classList.toggle('is-active', charredOnly); const node=charredButton.querySelector('[data-charred-count]'); if(node) node.textContent=String(charredCount); }
    const count = el.querySelector('[data-section-count]');
    if (count) count.textContent = String(total);
    const chips = el.querySelector('[data-active-filter-chips]');
    if (chips) chips.innerHTML = activeFilterChipsMarkup({ activeTypes, activeGroupIds, groups: collectionGroups, source, status: allowStatus ? status : '', search, groupMatch });
    const grid = el.querySelector('[data-items-grid]');
    if (!grid) return;
    grid.className = viewMode === 'list' ? 'media-grid media-grid--list unified-grid' : `media-grid unified-grid card-format-${cardFormat}`;
    const size = SIZE_MAP[currentSize()] || SIZE_MAP.medium;
    grid.style.setProperty('--card-min', `${size.width}px`);
    grid.style.setProperty('--card-width', `${cardFormat === 'simple' ? size.simpleWidth : size.width}px`);
    grid.style.setProperty('--card-gap', `${size.gap}px`);
    grid.style.setProperty('--poster-size', `${size.poster}px`);
    grid.style.setProperty('--mobile-columns', String(size.mobileColumns || 2));
    if (!visibleItems.length) grid.innerHTML = `<div class="empty-state"><strong>No hay items</strong><span>Ajusta filtros o añade contenido.</span></div>`;
    else grid.innerHTML = viewMode === 'list' ? itemListMarkup(visibleItems, { context: id, groups: collectionGroups }) : groupRowsMarkup(visibleItems);
    const pager = el.querySelector('[data-pagination]');
    if (pager) pager.innerHTML = paginationMarkup({ page, pages, total });
    updateControlsState();
    const bg = el.querySelector('[data-dynamic-bg]');
    const bgImage = bg?.querySelector('.section-bg__image');
    const bgItem = visibleItems.find(backdropFor);
    if (bgImage) bgImage.style.backgroundImage = bgItem ? `url('${escapeAttr(backdropFor(bgItem))}')` : '';
  }
  function itemBelongsToCurrentView(item = {}) {
    if (view === 'database') return true;
    if (view === 'backlog') return item.status === 'backlog' || item.states?.inBacklog === true;
    if (view === 'on-deck') return item.status === 'on-deck' || item.states?.inOnDeck === true;
    if (view === 'collections') return item.status === 'completed' || item.states?.completed === true || Boolean(item.rating || item.completedAt);
    return true;
  }
  function applyItemUpdate(item = {}) {
    const key = item.canonicalId || item.id;
    if (!key) return;
    const matches = entry => (entry.canonicalId || entry.id) === key;
    const index = allItems.findIndex(matches);
    const belongs = itemBelongsToCurrentView(item);
    if (index >= 0 && belongs) allItems[index] = { ...allItems[index], ...item };
    else if (index >= 0) allItems.splice(index, 1);
    else if (belongs) allItems.unshift(item);
    applyFilters();
    if (isVisible) render();
  }
  async function openItem(item) {
    await openItemDetail({ ui, api, item, context: id, toast: message => ui.toast(message), collectionGroups, settings, onItemUpdated: applyItemUpdate });
    load();
  }
  function findItemFromEvent(event) {
    const node = event.target.closest('[data-id], [data-canonical-id]');
    if (!node) return null;
    const key = node.dataset.canonicalId || node.dataset.id;
    return allItems.find(item => item.canonicalId === key || item.id === key);
  }
  return {
    id,
    mount(target) {
      el = target;
      loadSession();
      el.innerHTML = `<div class="app-section ${id}-view unified-view"><div class="section-bg" data-dynamic-bg><div class="section-bg__image is-visible"></div></div><header class="section-title"><div class="section-title__main"><h1>${escapeHtml(title)} <span data-section-count>0</span></h1>${id === 'database' ? '<button type="button" class="section-title__charred" data-toggle-charred hidden><span aria-hidden="true">♨</span><strong data-charred-count>0</strong></button><button type="button" class="section-title__add" data-create-manual-item title="Crear item">＋</button>' : ''}</div><div data-active-filter-chips></div></header><main class="unified-view__content"><div class="media-grid unified-grid" data-items-grid></div></main><footer class="unified-view__footer" data-pagination></footer></div>`;
      el.addEventListener('click', event => {
        if (event.target.closest('[data-page-prev]')) { page = Math.max(1, page - 1); render(); saveSession(); return; }
        if (event.target.closest('[data-page-next]')) { page = Math.min(pages, page + 1); render(); saveSession(); return; }
        if (event.target.closest('[data-create-manual-item]')) { openCreateManualItem(); return; }
        if (event.target.closest('[data-toggle-charred]')) { charredOnly = !charredOnly; page = 1; render(); return; }
        const item = findItemFromEvent(event);
        if (item) openItem(item);
      });
    },
    show() { isVisible = true; el?.classList.add('view--active'); el?.classList.remove('view--render-hidden'); el?.setAttribute('aria-hidden', 'false'); renderControls({ force: true }); load(); },
    hide() { isVisible = false; controlsMounted = false; if (controlsRoot) controlsRoot.innerHTML = ''; el?.classList.remove('view--active'); el?.setAttribute('aria-hidden', 'true'); },
    update(payload = {}) {
      if (payload.collectionGroups) collectionGroups = payload.collectionGroups;
      if (payload.settings) settings = payload.settings;
      if (payload.item) applyItemUpdate(payload.item);
      if (payload.refresh && isVisible) load();
      else if (isVisible && !payload.item) render();
    },
    refresh() { return load(); }
  };
}
