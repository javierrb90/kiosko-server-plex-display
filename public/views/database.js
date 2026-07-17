import { openItemDetail } from '/core/item-detail.js';

function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
function clamp(value, min, max, fallback) { const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; }

export function createDatabaseView({ api, ui, controlsRoot } = {}) {
  let el;
  let items = [];
  let total = 0;
  let pages = 1;
  let page = 1;
  let limit = 60;
  let search = '';
  let activeTypes = new Set(['games','movies','series']);
  let source = '';
  let status = '';
  let sort = 'lastActivityAt';
  let direction = 'desc';
  let viewMode = 'grid';
  let cardSize = 'medium';
  let isVisible = false;
  let loading = false;
  let controlsMounted = false;
  let collectionGroups = [];
  let activeGroupIds = new Set();
  let groupMatch = 'any';
  let settings = {};
  const typeLabels = { games: 'Juegos', movies: 'Películas', series: 'Series' };
  const statusLabels = { '': 'Todos', known: 'Conocidos', backlog: 'Backlog', 'on-deck': 'On Deck', completed: 'Colecciones' };
  const sizeMap = { small: { width: 220, gap: 12, poster: 74, mobileColumns: 2 }, medium: { width: 290, gap: 16, poster: 92, mobileColumns: 3 }, large: { width: 360, gap: 18, poster: 110, mobileColumns: 4 } };

  function sessionKey() { return 'kiosko:v6.6:database'; }
  function saveSession() { try { localStorage.setItem(sessionKey(), JSON.stringify({ search, activeTypes: [...activeTypes], source, status, sort, direction, viewMode, cardSize, limit, activeGroupIds: [...activeGroupIds], groupMatch })); } catch {} }
  function loadSession() {
    try {
      const parsed = JSON.parse(localStorage.getItem(sessionKey()) || 'null');
      if (!parsed) return;
      if (typeof parsed.search === 'string') search = parsed.search;
      if (Array.isArray(parsed.activeTypes)) activeTypes = new Set(parsed.activeTypes.filter(type => ['games','movies','series'].includes(type)));
      if (typeof parsed.source === 'string') source = parsed.source;
      if (typeof parsed.status === 'string') status = parsed.status;
      if (['lastActivityAt','firstSeenAt','updatedAt','title','source','collectionType','rating','completedAt'].includes(parsed.sort)) sort = parsed.sort;
      if (['asc','desc'].includes(parsed.direction)) direction = parsed.direction;
      if (['grid','list'].includes(parsed.viewMode)) viewMode = parsed.viewMode;
      if (['small','medium','large'].includes(parsed.cardSize)) cardSize = parsed.cardSize;
      limit = clamp(parsed.limit, 10, 250, 60);
      if (Array.isArray(parsed.activeGroupIds)) activeGroupIds = new Set(parsed.activeGroupIds);
      if (['any','all'].includes(parsed.groupMatch)) groupMatch = parsed.groupMatch;
    } catch {}
  }
  function typeFor(item) { return ['games','movies','series'].includes(item.collectionType) ? item.collectionType : 'series'; }
  function currentSize() { return ['small','medium','large'].includes(cardSize) ? cardSize : 'medium'; }
  function imageFor(item) { return item.poster || item.posterUrl || item.cover || ''; }
  function date(value) { const d = new Date(value); return Number.isFinite(d.getTime()) ? d.toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' }) : ''; }
  function stars(value = 0) { const n = Math.max(0, Math.min(5, Number(value) || 0)); return n ? `<span class="star-rating">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>` : ''; }
  function statusLabel(item = {}) { return statusLabels[item.status] || item.status || 'Conocido'; }
  function groupItemKeys(item = {}) {
    const meta = item.meta || item.metadata || {};
    return [...new Set([item.canonicalId, meta.canonicalId, item.id, item.gameId, meta.gameId, item.ratingKey, meta.ratingKey, meta.relatedSeriesCanonicalId, meta.relatedOnDeckCanonicalId].filter(Boolean).map(String))];
  }
  function fieldValues(item = {}, field = '') {
    const meta = item.meta || item.metadata || {};
    const asArray = value => Array.isArray(value) ? value : (value ? [value] : []);
    const valueMap = { title: [item.title], source: [item.source], type: [item.collectionType, item.type, meta.plexType], year: [item.year, item.releaseYear, meta.releaseYear], platform: [...asArray(item.platforms), ...asArray(meta.platforms), item.subtitle], platforms: [...asArray(item.platforms), ...asArray(meta.platforms), item.subtitle], genre: [...asArray(item.genres), ...asArray(meta.genres), ...asArray(item.genre), ...asArray(meta.genre)], genres: [...asArray(item.genres), ...asArray(meta.genres), ...asArray(item.genre), ...asArray(meta.genre)], developer: [...asArray(item.developers), ...asArray(meta.developers)], publisher: [...asArray(item.publishers), ...asArray(meta.publishers)] };
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
    const checks = rules.map(rule => { const values = fieldValues(item, rule.field); const needle = String(rule.value || '').toLowerCase(); if (!needle) return false; return rule.operator === 'equals' ? values.some(value => value === needle) : values.some(value => value.includes(needle)); });
    return (group.match || 'all') === 'any' ? checks.some(Boolean) : checks.every(Boolean);
  }
  function applyGroupFilter(rows = []) {
    const ids = [...activeGroupIds];
    if (!ids.length) return rows;
    const selected = collectionGroups.filter(group => ids.includes(group.id));
    if (!selected.length) return rows;
    return rows.filter(item => groupMatch === 'all' ? selected.every(group => itemInGroup(item, group)) : selected.some(group => itemInGroup(item, group)));
  }
  function queryString(extra = {}) {
    const params = new URLSearchParams();
    params.set('page', String(extra.page || page));
    params.set('limit', String(extra.limit || limit));
    params.set('sort', extra.sort || sort);
    params.set('direction', extra.direction || direction);
    if (search.trim()) params.set('search', search.trim());
    if (source) params.set('source', source);
    if (status) params.set('status', status);
    const selected = [...activeTypes];
    if (!selected.length) params.set('type', '__none__');
    else if (selected.length < 3) params.set('type', selected.join(','));
    return params.toString();
  }
  async function load({ resetPage = false } = {}) {
    if (resetPage) page = 1;
    loading = true;
    render();
    try {
      const groupMode = activeGroupIds.size > 0;
      const result = await api(`/api/items?${groupMode ? queryString({ page: 1, limit: 10000 }) : queryString()}&sync=1`);
      if (groupMode) {
        const filtered = applyGroupFilter(result.items || []);
        total = filtered.length;
        pages = Math.max(1, Math.ceil(total / limit));
        page = Math.max(1, Math.min(page, pages));
        items = filtered.slice((page - 1) * limit, (page - 1) * limit + limit);
      } else {
        items = result.items || [];
        total = result.total || 0;
        pages = result.pages || 1;
        page = result.page || page;
      }
      saveSession();
    } catch (error) {
      ui.toast('No se pudo cargar la base de datos', { detail: error.message || '' });
    } finally {
      loading = false;
      render();
    }
  }
  function countsMarkup() {
    return `<div class="database-summary"><span>${total} item(s)</span><span>${statusLabels[status] || 'Todos'}</span><span>${viewMode === 'grid' ? 'Grid' : 'Lista'}</span></div>`;
  }
  function typeFilterBarMarkup() {
    const types = ['games','movies','series'];
    return `<div class="type-filter-bar">${types.map(type => `<button type="button" data-db-toggle-type="${type}" class="${activeTypes.has(type) ? 'is-active' : ''}">${escapeHtml(typeLabels[type])}</button>`).join('')}</div>`;
  }
  function cardMarkup(item) {
    const img = imageFor(item);
    return `<article class="media-card media-card--rich source-${escapeAttr(item.source || 'other')}" data-id="${escapeAttr(item.canonicalId)}" data-source="${escapeAttr(item.source || '')}">
      <div class="media-card__surface">
        <div class="media-card__poster">${img ? `<img src="${escapeAttr(img)}" loading="lazy" alt="">` : `<div class="media-card__fallback">${escapeHtml((item.title || '?').slice(0,1))}</div>`}</div>
        <div class="media-card__meta">
          <strong>${escapeHtml(item.title || 'Sin título')}</strong>
          <span>${escapeHtml(item.subtitle || typeLabels[typeFor(item)] || '')}</span>
          ${minimalDateMarkup(item)}
          <div class="media-card__badges"><span>${escapeHtml(item.source || 'manual')}</span><span>${escapeHtml(statusLabel(item))}</span></div>
          ${stars(item.rating)}
        </div>
      </div>
    </article>`;
  }

  function formatMiniDate(value) {
    const d = new Date(value || '');
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '';
  }
  function minimalDateMarkup(item = {}) {
    const completed = formatMiniDate(item.completedAt);
    if (completed) return `<time class="media-card__date" title="Finalizado">✓ ${escapeHtml(completed)}</time>`;
    const active = formatMiniDate(item.lastActivityAt || item.lastSeenAt || item.updatedAt || item.createdAt);
    return active ? `<time class="media-card__date" title="Última actividad">↻ ${escapeHtml(active)}</time>` : '';
  }

  function listMarkup() {
    return `<div class="kiosko-list" role="table" aria-label="Base de datos">
      <div class="kiosko-list__row kiosko-list__row--head" role="row"><span>Título</span><span>Fuente</span><span>Tipo</span><span>Estado</span><span>Rating</span><span>Última vez</span></div>
      ${items.map(item => `<button type="button" class="kiosko-list__row" role="row" data-id="${escapeAttr(item.canonicalId)}"><span><strong>${escapeHtml(item.title || 'Sin título')}</strong><small>${escapeHtml(item.subtitle || '')}</small></span><span>${escapeHtml(item.source || '')}</span><span>${escapeHtml(typeLabels[typeFor(item)] || item.type || '')}</span><span>${escapeHtml(statusLabel(item))}</span><span>${item.rating ? escapeHtml(String(item.rating)) : '—'}</span><span>${escapeHtml(date(item.completedAt || item.lastActivityAt || item.updatedAt))}</span></button>`).join('')}
    </div>`;
  }
  function renderControls({ force = false } = {}) {
    if (!controlsRoot || !isVisible) return;
    if (!force && controlsMounted) return;
    controlsMounted = true;
    controlsRoot.innerHTML = `<div class="collection-toolbar"><label class="collection-search"><input type="search" data-db-quick-search value="${escapeAttr(search)}" placeholder="Buscar en base de datos" autocomplete="off"></label><button type="button" class="view-actions-button view-filter-button" data-db-toggle-view>${viewMode === 'grid' ? 'Lista' : 'Grid'}</button><button type="button" class="view-actions-button view-filter-button" data-db-open-controls aria-label="Filtros y vista"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v2H4V6Zm3 5h10v2H7v-2Zm3 5h4v2h-4v-2Z"/></svg><span class="view-filter-button__label">Filtros</span><span class="view-filter-button__meta" data-db-filter-meta></span></button></div>`;
    controlsRoot.querySelector('[data-db-quick-search]')?.addEventListener('input', event => { search = event.target.value || ''; load({ resetPage: true }); });
    controlsRoot.querySelector('[data-db-toggle-view]')?.addEventListener('click', () => { viewMode = viewMode === 'grid' ? 'list' : 'grid'; renderControls({ force: true }); render(); });
    controlsRoot.querySelector('[data-db-open-controls]')?.addEventListener('click', openControlsModal);
    
    updateControlsState();
  }
  function updateControlsState() {
    const meta = controlsRoot?.querySelector('[data-db-filter-meta]');
    if (meta) meta.textContent = `${activeTypes.size}/3 · ${activeGroupIds.size ? activeGroupIds.size + ' grupos · ' : ''}${viewMode === 'grid' ? currentSize().slice(0,1).toUpperCase() : 'Lista'} · ${limit}`;
  }
  async function openControlsModal() {
    const body = `<div class="controls-modal">
      <section class="controls-modal__section controls-modal__section--mobile-search"><h3>Búsqueda</h3><label class="ui-field"><span>Buscar</span><input type="search" data-control-search value="${escapeAttr(search)}" placeholder="Buscar"></label></section>
      <section class="controls-modal__section"><h3>Tipos</h3><div class="controls-modal__checks">${['games','movies','series'].map(type => `<label class="controls-modal__toggle"><input type="checkbox" data-filter-type="${type}" ${activeTypes.has(type) ? 'checked' : ''}><span>${typeLabels[type]}</span></label>`).join('')}</div></section>
      <section class="controls-modal__section"><h3>Grupos</h3><div class="segmented-control"><label><input type="radio" name="db-group-match" value="any" ${groupMatch === 'any' ? 'checked' : ''}><span>Cualquiera</span></label><label><input type="radio" name="db-group-match" value="all" ${groupMatch === 'all' ? 'checked' : ''}><span>Todos</span></label></div><div class="controls-modal__checks">${collectionGroups.length ? collectionGroups.map(group => `<label class="controls-modal__toggle"><input type="checkbox" data-filter-group="${escapeAttr(group.id)}" ${activeGroupIds.has(group.id) ? 'checked' : ''}><span>${escapeHtml(group.name)}</span><small>${escapeHtml(group.mode || 'manual')}</small></label>`).join('') : '<p class="settings-help">No hay grupos creados.</p>'}</div></section>
      <section class="controls-modal__section"><h3>Estado</h3><label class="ui-field"><span>Estado</span><select data-control-status>${Object.entries(statusLabels).map(([value,label]) => `<option value="${escapeAttr(value)}" ${status === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label><label class="ui-field"><span>Fuente</span><input data-control-source value="${escapeAttr(source)}" placeholder="plex, playnite..."></label></section>
      <section class="controls-modal__section"><h3>Vista</h3><div class="segmented-control"><label><input type="radio" name="db-view-mode" value="grid" ${viewMode === 'grid' ? 'checked' : ''}><span>Grid</span></label><label><input type="radio" name="db-view-mode" value="list" ${viewMode === 'list' ? 'checked' : ''}><span>Lista</span></label></div><div class="controls-modal__sizes">${[['small','S'],['medium','M'],['large','L']].map(([value,label]) => `<label class="controls-modal__toggle"><input type="radio" name="db-size" value="${value}" ${currentSize() === value ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div><label class="ui-field"><span>Items por página</span><input data-items-per-page type="number" min="10" max="250" value="${escapeAttr(limit)}"></label></section>
      <section class="controls-modal__section"><h3>Orden</h3><label class="ui-field"><span>Ordenar por</span><select data-control-sort>${[['lastActivityAt','Última actividad'],['firstSeenAt','Entrada en BD'],['updatedAt','Actualización'],['title','Título'],['rating','Rating'],['completedAt','Completado']].map(([value,label]) => `<option value="${value}" ${sort === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><div class="segmented-control"><label><input type="radio" name="db-direction" value="desc" ${direction === 'desc' ? 'checked' : ''}><span>Desc</span></label><label><input type="radio" name="db-direction" value="asc" ${direction === 'asc' ? 'checked' : ''}><span>Asc</span></label></div></section>
      <section class="controls-modal__section"><h3>Exportación</h3><p class="settings-help">Usa el botón “Exportar CSV” de este modal para descargar lo filtrado.</p></section>
    </div>`;
    const result = await ui.open({
      title: 'Base de datos · filtros',
      body,
      actions: [
        { label: 'Cancelar', value: null },
        { label: 'Exportar CSV', onClick: () => { exportCsv(); return false; } },
        { label: 'Aplicar', variant: 'primary', onClick: root => ({
          search: root.querySelector('[data-control-search]')?.value || search,
          activeTypes: [...root.querySelectorAll('[data-filter-type]:checked')].map(input => input.dataset.filterType),
          activeGroupIds: [...root.querySelectorAll('[data-filter-group]:checked')].map(input => input.dataset.filterGroup),
          groupMatch: root.querySelector('input[name="db-group-match"]:checked')?.value || groupMatch,
          source: root.querySelector('[data-control-source]')?.value.trim() || '',
          status: root.querySelector('[data-control-status]')?.value || '',
          viewMode: root.querySelector('input[name="db-view-mode"]:checked')?.value || viewMode,
          cardSize: root.querySelector('input[name="db-size"]:checked')?.value || cardSize,
          limit: clamp(root.querySelector('[data-items-per-page]')?.value, 10, 250, limit),
          sort: root.querySelector('[data-control-sort]')?.value || sort,
          direction: root.querySelector('input[name="db-direction"]:checked')?.value || direction
        }) }
      ]
    });
    if (!result) return;
    search = result.search;
    activeTypes = new Set((result.activeTypes || []).filter(type => ['games','movies','series'].includes(type)));
    activeGroupIds = new Set(result.activeGroupIds || []);
    groupMatch = ['any','all'].includes(result.groupMatch) ? result.groupMatch : 'any';
    source = result.source;
    status = result.status;
    viewMode = result.viewMode;
    cardSize = result.cardSize;
    limit = result.limit;
    sort = result.sort;
    direction = result.direction;
    await load({ resetPage: true });
  }
  function exportCsv() {
    window.open(`/api/items/export.csv?${queryString({ page: 1, limit: 10000 })}&sync=1`, '_blank');
  }
  function render() {
    if (!el || !isVisible) return;
    const title = el.querySelector('.section-title');
    if (title) {
      el.querySelector('[data-section-count]').textContent = String(total);

    }
    const grid = el.querySelector('[data-database-content]');
    grid.classList.toggle('media-grid--list', viewMode === 'list');
    const cfg = sizeMap[currentSize()];
    grid.style.setProperty('--card-width', `${cfg.width}px`);
    grid.style.setProperty('--card-gap', `${cfg.gap}px`);
    grid.style.setProperty('--card-poster-size', `${cfg.poster}px`);
    grid.style.setProperty('--mobile-columns', String(cfg.mobileColumns));
    if (loading) grid.innerHTML = `<div class="empty-state"><strong>Cargando base de datos…</strong></div>`;
    else if (!items.length) grid.innerHTML = `<div class="empty-state"><strong>No hay items que coincidan.</strong><span>Prueba a cambiar filtros o sincronizar desde /api/items/sync.</span></div>`;
    else grid.innerHTML = viewMode === 'list' ? listMarkup() : items.map(cardMarkup).join('');
    el.querySelector('[data-db-summary]').innerHTML = countsMarkup();
    el.querySelector('[data-page-label]').textContent = `${page}/${pages}`;
    el.querySelector('[data-prev]').disabled = page <= 1;
    el.querySelector('[data-next]').disabled = page >= pages;
    updateControlsState();
    saveSession();
  }
  async function openItem(canonicalId) {
    const item = items.find(entry => entry.canonicalId === canonicalId) || await api(`/api/items/${encodeURIComponent(canonicalId)}`);
    return openItemDetail({ ui, api, item, context: 'database', toast: message => ui.toast(message), collectionGroups, settings });
  }
  return {
    id: 'database',
    mount(target) {
      el = target;
      loadSession();
      el.innerHTML = `<div class="app-section database-view"><div class="section-bg"></div><header class="section-title"><h1>Base de datos <span data-section-count>0</span></h1></header><div data-db-summary></div><section class="media-grid" data-database-content aria-label="Base de datos"></section><footer class="pager"><button data-prev aria-label="Página anterior">‹</button><span data-page-label>1/1</span><button data-next aria-label="Página siguiente">›</button></footer></div>`;
      el.addEventListener('click', async event => {
        const typeButton = event.target.closest('[data-db-toggle-type]');
        if (typeButton) { const type = typeButton.dataset.dbToggleType; if (activeTypes.has(type)) activeTypes.delete(type); else activeTypes.add(type); await load({ resetPage: true }); return; }
        if (event.target.closest('[data-prev]')) { page -= 1; await load(); return; }
        if (event.target.closest('[data-next]')) { page += 1; await load(); return; }
        const card = event.target.closest('[data-id]');
        if (card) await openItem(card.dataset.id);
      });
    },
    show() { isVisible = true; controlsMounted = false; el.classList.add('view--active'); el.classList.remove('view--render-hidden'); el.setAttribute('aria-hidden', 'false'); renderControls({ force: true }); load(); },
    activate() { isVisible = true; el.classList.add('view--active'); el.classList.remove('view--render-hidden'); el.setAttribute('aria-hidden', 'false'); renderControls({ force: true }); },
    hide() { isVisible = false; controlsMounted = false; el.classList.remove('view--active'); el.setAttribute('aria-hidden', 'true'); if (controlsRoot) controlsRoot.innerHTML = ''; },
    update(data = {}) { if (data.collectionGroups) collectionGroups = data.collectionGroups; if (data.settings) { settings = data.settings; cardSize = data.settings.views?.database?.cardSize || cardSize; limit = Number(data.settings.views?.database?.itemsPerPage || limit); } if (data.refresh && isVisible) load(); else render(); }
  };
}
