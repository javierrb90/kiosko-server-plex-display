import { openItemDetail } from '/core/item-detail.js';

export function createCollectionsView({ api, ui, controlsRoot } = {}) {
  let el;
  let items = [];
  let settings = {};
  let collectionGroups = [];
  let activeGroupIds = new Set();
  let groupMatch = 'any';
  let activeTypes = new Set(['games','movies','series']);
  let cardSize = 'medium';
  let viewMode = 'grid';
  let search = '';
  let page = 0;
  let isVisible = false;
  let bgTimer = null;
  let bgCurrentSrc = '';
  let controlsMounted = false;

  const sizeMap = { small: { width: 220, gap: 12, poster: 74, mobileColumns: 2 }, medium: { width: 290, gap: 16, poster: 92, mobileColumns: 3 }, large: { width: 360, gap: 18, poster: 110, mobileColumns: 4 } };
  const typeLabels = { games: 'Juegos', movies: 'Películas', series: 'Series' };

  function currentSize() { return ['small','medium','large'].includes(cardSize) ? cardSize : 'medium'; }
  function label(type) { return typeLabels[type] || 'Otros'; }
  function sourceLabel(source) { return source === 'plex' ? 'Plex' : source === 'playnite' ? 'Playnite' : 'Otros'; }
  function typeLabelForList(item = {}) { return typeLabels[item.collectionType] || item.type || 'Item'; }
  function stars(value = 0) { const n = Math.max(0, Math.min(5, Number(value) || 0)); return `<span class="star-rating">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`; }
  function ratingFor(item = {}) { return Number(item.rating || 0); }
  function date(value) { const d = new Date(value); return Number.isFinite(d.getTime()) ? d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : ''; }
  function configuredPageSize() { return clamp(Number(settings.views?.collections?.itemsPerPage), 1, 250, 12); }
  function showSourceText() { return settings.design?.cards?.showSourceText === true; }
  function dayStart(date = new Date()) { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; }
  function dateGroupFor(item = {}) {
    const value = item.completedAt || item.updatedAt || item.createdAt;
    const timestamp = Date.parse(value || '');
    if (!Number.isFinite(timestamp)) return 'PREVIOUS';
    const today = dayStart();
    const itemDay = dayStart(timestamp);
    const diffDays = Math.floor((today.getTime() - itemDay.getTime()) / 86400000);
    if (diffDays <= 0) return 'TODAY';
    if (diffDays === 1) return 'YESTERDAY';
    if (diffDays <= 7) return 'LAST WEEK';
    return 'PREVIOUS';
  }
  function groupedRows(list = []) {
    const rows = [];
    let lastGroup = null;
    for (const item of list) {
      const group = dateGroupFor(item);
      if (group !== lastGroup) {
        rows.push({ kind: 'heading', id: `heading-${group}-${rows.length}`, label: group });
        lastGroup = group;
      }
      rows.push({ kind: 'item', item });
    }
    return rows;
  }


  function sessionKey() { return 'kiosko:v5.7:collections'; }
  function saveSession() { try { localStorage.setItem(sessionKey(), JSON.stringify({ activeTypes: [...activeTypes], search, page, cardSize, viewMode, activeGroupIds: [...activeGroupIds], groupMatch })); } catch {} }
  function loadSession() {
    try {
      const parsed = JSON.parse(localStorage.getItem(sessionKey()) || localStorage.getItem('kiosko:v5.4.2:collections') || localStorage.getItem('kiosko:v5.4:collections') || 'null');
      if (!parsed) return;
      if (Array.isArray(parsed.activeTypes)) activeTypes = new Set(parsed.activeTypes.filter(type => ['games','movies','series'].includes(type)));
      if (typeof parsed.search === 'string') search = parsed.search;
      if (Number.isFinite(Number(parsed.page))) page = Math.max(0, Number(parsed.page));
      if (['small','medium','large'].includes(parsed.cardSize)) cardSize = parsed.cardSize;
      if (['grid','list'].includes(parsed.viewMode)) viewMode = parsed.viewMode;
      if (Array.isArray(parsed.activeGroupIds)) activeGroupIds = new Set(parsed.activeGroupIds);
      if (['any','all'].includes(parsed.groupMatch)) groupMatch = parsed.groupMatch;
    } catch {}
  }

  function countsByType() {
    return items.reduce((acc, item) => { const type = item.collectionType; if (['games','movies','series'].includes(type)) acc[type] = (acc[type] || 0) + 1; return acc; }, { games: 0, movies: 0, series: 0 });
  }


  function fieldValues(item = {}, field = '') {
    const meta = item.meta || {};
    const asArray = value => Array.isArray(value) ? value : (value ? [value] : []);
    const platformCandidates = [
      ...asArray(item.platforms),
      ...asArray(meta.platforms),
      ...asArray(item.platform),
      ...asArray(meta.platform),
      item.subtitle
    ];
    const genreCandidates = [...asArray(item.genres), ...asArray(meta.genres), ...asArray(item.genre), ...asArray(meta.genre)];
    const developerCandidates = [...asArray(item.developers), ...asArray(meta.developers), ...asArray(item.developer), ...asArray(meta.developer)];
    const publisherCandidates = [...asArray(item.publishers), ...asArray(meta.publishers), ...asArray(item.publisher), ...asArray(meta.publisher)];
    const valueMap = {
      title: [item.title],
      source: [item.source],
      type: [item.collectionType, item.type, meta.plexType],
      year: [item.year, item.releaseYear, meta.releaseYear],
      platform: platformCandidates,
      platforms: platformCandidates,
      genre: genreCandidates,
      genres: genreCandidates,
      developer: developerCandidates,
      developers: developerCandidates,
      publisher: publisherCandidates,
      publishers: publisherCandidates
    };
    return (valueMap[field] || [item[field], meta[field]]).flat().filter(Boolean).map(value => String(value).toLowerCase());
  }
  function itemKeys(item = {}) {
    return [item.id, item.canonicalId, item.gameId, item.ratingKey].filter(Boolean).map(String);
  }
  function groupMatchesItem(group = {}, item = {}) {
    const keys = itemKeys(item);
    const excluded = (group.excludedItemIds || []).map(String);
    if (keys.some(key => excluded.includes(key))) return false;
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
      if (rule.operator === 'equals') return values.some(value => value === needle);
      return values.some(value => value.includes(needle));
    });
    return (group.match || 'all') === 'any' ? checks.some(Boolean) : checks.every(Boolean);
  }
  async function refreshCollectionGroups() {
    const response = await api('/api/collection-groups').catch(() => null);
    if (response?.groups) {
      collectionGroups = response.groups;
      activeGroupIds = new Set([...activeGroupIds].filter(id => collectionGroups.some(group => group.id === id)));
      controlsMounted = false;
    }
    return collectionGroups;
  }

  function itemMatchesActiveGroups(item = {}) {
    const ids = [...activeGroupIds];
    if (!ids.length) return true;
    const groups = ids.map(id => collectionGroups.find(group => group.id === id)).filter(Boolean);
    if (!groups.length) return true;
    const checks = groups.map(group => groupMatchesItem(group, item));
    return groupMatch === 'all' ? checks.every(Boolean) : checks.some(Boolean);
  }


  function typeFilterBarMarkup() {
    const types = ["games", "movies", "series"];
    return `<div class="type-filter-bar">${types.map(type => `<button type="button" data-toggle-type="${type}" class="${activeTypes.has(type) ? 'is-active' : ''}">${escapeHtml(typeLabels[type] || type)}</button>`).join('')}</div>`;
  }
  function activeGroupCount(group = {}, list = null) {
    const pool = list || filtered(false);
    return pool.filter(item => groupMatchesItem(group, item)).length;
  }
  function groupMatchToggleMarkup() {
    if (activeGroupIds.size < 2) return '';
    return `<div class="active-filter-match"><button type="button" data-group-match-set="any" class="${groupMatch === 'any' ? 'is-active' : ''}">Cualquiera</button><button type="button" data-group-match-set="all" class="${groupMatch === 'all' ? 'is-active' : ''}">Todos</button></div>`;
  }

  function activeFiltersMarkup() {
    const groupChips = [...activeGroupIds].map(id => collectionGroups.find(group => group.id === id)).filter(Boolean);
    const groupHtml = groupChips.map(group => `<span class="active-filter-chip" data-active-group="${escapeAttr(group.id)}">${escapeHtml(group.name)} <button type="button" data-clear-group="${escapeAttr(group.id)}" aria-label="Quitar grupo">×</button></span>`).join('');
    return groupHtml ? `<div class="active-filter-panel active-filter-panel--compact"><div class="active-filter-groups"><span>Grupos</span><div class="active-filter-chips">${groupHtml}</div>${groupMatchToggleMarkup()}</div></div>` : '';
  }

  function cardGroupsMarkup(item = {}) {
    const groups = collectionGroups.filter(group => groupMatchesItem(group, item));
    if (!groups.length) return '';
    return `<div class="media-card__groups">${groups.slice(0, 3).map(group => `<span data-group-chip="${escapeAttr(group.id)}">${escapeHtml(group.name)}</span>`).join('')}${groups.length > 3 ? `<span>+${groups.length - 3}</span>` : ''}</div>`;
  }

  function filtered(applyGroups = true) {
    const q = search.trim().toLowerCase();
    return items
      .filter(item => activeTypes.has(item.collectionType))
      .filter(item => !applyGroups || itemMatchesActiveGroups(item))
      .filter(item => !q || `${item.title || ''} ${label(item.collectionType)} ${sourceLabel(item.source)}`.toLowerCase().includes(q))
      .sort((a,b)=>Date.parse(b.completedAt||0)-Date.parse(a.completedAt||0));
  }

  function visible() {
    const list = filtered();
    const pageSize = configuredPageSize();
    const pages = Math.max(1, Math.ceil(list.length / pageSize));
    page = Math.max(0, Math.min(page, pages - 1));
    return { rows: list.slice(page * pageSize, page * pageSize + pageSize), total: list.length, pages };
  }

  function backgroundRotationMs() {
    const seconds = Number(settings.design?.background?.rotationSeconds || 12);
    return Math.max(3, Math.min(120, Number.isFinite(seconds) ? seconds : 12)) * 1000;
  }

  function backgroundFadeMs() {
    const seconds = Number(settings.design?.background?.fadeSeconds ?? 0.75);
    return Math.max(0, Math.min(5, Number.isFinite(seconds) ? seconds : 0.75)) * 1000;
  }

  function pickBackground(candidates = [], { keepCurrent = false } = {}) {
    if (!candidates.length) return null;
    if (keepCurrent && bgCurrentSrc) {
      const current = candidates.find(item => (item.backdrop || item.poster) === bgCurrentSrc);
      if (current) return current;
    }
    if (candidates.length === 1) return candidates[0];
    const pool = candidates.filter(item => (item.backdrop || item.poster) !== bgCurrentSrc);
    return (pool.length ? pool : candidates)[Math.floor(Math.random() * (pool.length ? pool.length : candidates.length))] || candidates[0];
  }

  function setBackground(items, { randomize = false } = {}) {
    const bg = el?.querySelector('[data-dynamic-bg]');
    if (!bg) return;
    const candidates = items.filter(item => item.backdrop || item.poster);
    if (!candidates.length) { bg.innerHTML = ''; bg.dataset.src = ''; bgCurrentSrc = ''; return; }
    const candidate = pickBackground(candidates, { keepCurrent: !randomize });
    const src = candidate?.backdrop || candidate?.poster;
    if (!src || bg.dataset.src === src) return;
    bg.dataset.src = src;
    bgCurrentSrc = src;
    const img = document.createElement('img');
    img.className = 'section-bg__image';
    img.alt = '';
    img.src = src;
    bg.appendChild(img);
    requestAnimationFrame(() => img.classList.add('is-visible'));
    const oldImages = [...bg.querySelectorAll('.section-bg__image')].filter(node => node !== img);
    window.setTimeout(() => oldImages.forEach(node => node.remove()), backgroundFadeMs() + 120);
  }

  function restartBackgroundRotation() {
    clearInterval(bgTimer);
    const data = filtered().filter(item => item.backdrop || item.poster);
    setBackground(data, { randomize: false });
    if (data.length > 1 && isVisible) bgTimer = setInterval(() => setBackground(data, { randomize: true }), backgroundRotationMs());
  }


  function csvEscape(value) {
    const text = String(value ?? '');
    return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }
  function downloadCsv() {
    const headers = ['title','subtitle','source','type','collectionType','rating','completedAt','updatedAt','canonicalId'];
    const rows = filtered();
    const csv = [headers.join(',')].concat(rows.map(item => headers.map(key => csvEscape(key === 'rating' ? ratingFor(item) : item[key])).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kiosko-collection-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function renderControls({ force = false } = {}) {
    if (!controlsRoot || !isVisible) return;
    if (!force && controlsMounted) return;
    controlsMounted = true;
    controlsRoot.innerHTML = `<div class="collection-toolbar"><label class="collection-search"><input type="search" data-collection-quick-search value="${escapeAttr(search)}" placeholder="Buscar en colecciones" autocomplete="off"></label><button type="button" class="view-actions-button view-filter-button" data-collection-toggle-view aria-label="Cambiar vista">${viewMode === 'grid' ? 'Lista' : 'Grid'}</button><button type="button" class="view-actions-button view-filter-button" data-collection-open-controls aria-label="Filtros y vista"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v2H4V6Zm3 5h10v2H7v-2Zm3 5h4v2h-4v-2Z"/></svg><span class="view-filter-button__label">Filtros</span><span class="view-filter-button__meta" data-collection-filter-meta></span></button></div>`;
    const searchInput = controlsRoot.querySelector('[data-collection-quick-search]');
    searchInput?.addEventListener('input', event => { search = event.target.value || ''; page = 0; render(); });
    controlsRoot.querySelector('[data-collection-toggle-view]')?.addEventListener('click', () => { viewMode = viewMode === 'grid' ? 'list' : 'grid'; renderControls({ force: true }); render(); });
    updateControlsState();
  }

  function updateControlsState() {
    if (!controlsRoot || !isVisible) return;
    const meta = controlsRoot.querySelector('[data-collection-filter-meta]');
    if (meta) meta.textContent = `${activeTypes.size}/3 · ${viewMode === 'grid' ? currentSize().slice(0,1).toUpperCase() : 'Lista'} · ${configuredPageSize()}${activeGroupIds.size ? ` · ${activeGroupIds.size} grupo(s)` : ''}`;
  }

  async function openControlsModal() {
    await refreshCollectionGroups();
    const counts = countsByType();
    const body = `<div class="controls-modal">\n      <section class="controls-modal__section controls-modal__section--mobile-search"><h3>Búsqueda</h3><label class="ui-field"><span>Buscar</span><input type="search" data-control-search value="${escapeAttr(search)}" placeholder="Buscar" autocomplete="off"></label></section>
      <section class="controls-modal__section"><h3>Tipos</h3><div class="controls-modal__checks">
        ${['games','movies','series'].map(type => `<label class="controls-modal__toggle"><input type="checkbox" data-filter-type="${type}" ${activeTypes.has(type) ? 'checked' : ''}><span>${typeLabels[type]}</span><small>${counts[type] || 0}</small></label>`).join('')}
      </div></section>
      <section class="controls-modal__section"><h3>Vista</h3>
        <div class="controls-modal__sizes">
          ${[['small','S'],['medium','M'],['large','L']].map(([value,label]) => `<label class="controls-modal__toggle"><input type="radio" name="collection-size" value="${value}" ${currentSize() === value ? 'checked' : ''}><span>${label}</span></label>`).join('')}
        </div>
        <label class="ui-field"><span>Items por página</span><input data-items-per-page type="number" min="1" max="120" value="${escapeAttr(configuredPageSize())}"></label>
      </section>
      <section class="controls-modal__section"><h3>Modo</h3><div class="segmented-control"><label><input type="radio" name="view-mode" value="grid" ${viewMode === 'grid' ? 'checked' : ''}><span>Grid</span></label><label><input type="radio" name="view-mode" value="list" ${viewMode === 'list' ? 'checked' : ''}><span>Lista</span></label></div></section><section class="controls-modal__section"><h3>Grupos</h3>
        <div class="controls-modal__checks groups-filter">
          ${collectionGroups.length ? collectionGroups.map(group => `<label class="controls-modal__toggle"><input type="checkbox" data-filter-group="${escapeAttr(group.id)}" ${activeGroupIds.has(group.id) ? 'checked' : ''}><span data-group-chip="${escapeAttr(group.id)}">${escapeHtml(group.name)}</span><small>${activeGroupCount(group)} · ${escapeHtml(group.mode || 'manual')}</small></label>`).join('') : '<p class="settings-help">Todavía no hay grupos. Puedes crearlos en Opciones → Colecciones.</p>'}
        </div>
        <div class="segmented-control" role="group" aria-label="Coincidencia de grupos">
          <label><input type="radio" name="group-match" value="any" ${groupMatch === 'any' ? 'checked' : ''}><span>Cualquiera</span></label>
          <label><input type="radio" name="group-match" value="all" ${groupMatch === 'all' ? 'checked' : ''}><span>Todos</span></label>
        </div>
      </section>
    </div>`;
    const result = await ui.open({
      title: 'Filtros de Colecciones',
      body,
      actions: [
        { label: 'Cancelar', value: null },
        { label: 'Exportar CSV', onClick: () => { downloadCsv(); return false; } },
        { label: 'Aplicar', variant: 'primary', onClick: root => ({
          activeTypes: [...root.querySelectorAll('[data-filter-type]:checked')].map(input => input.dataset.filterType),
          cardSize: root.querySelector('input[name="collection-size"]:checked')?.value || currentSize(),
          viewMode: root.querySelector('input[name="view-mode"]:checked')?.value || viewMode,
          search: root.querySelector('[data-control-search]')?.value || search,
          itemsPerPage: Number(root.querySelector('[data-items-per-page]')?.value || configuredPageSize()),
          activeGroupIds: [...root.querySelectorAll('[data-filter-group]:checked')].map(input => input.dataset.filterGroup),
          groupMatch: root.querySelector('input[name="group-match"]:checked')?.value || 'any'
        }) }
      ]
    });
    if (!result) return;
    activeTypes = new Set(result.activeTypes.filter(type => ['games','movies','series'].includes(type)));
    if (activeTypes.size < 1) activeTypes = new Set(['games','movies','series']);
    cardSize = ['small','medium','large'].includes(result.cardSize) ? result.cardSize : 'medium';
    viewMode = ['grid','list'].includes(result.viewMode) ? result.viewMode : viewMode;
    activeGroupIds = new Set((result.activeGroupIds || []).filter(Boolean));
    groupMatch = ['any','all'].includes(result.groupMatch) ? result.groupMatch : 'any';
    search = result.search || search;
    await refreshCollectionGroups();
    page = 0;
    const itemsPerPage = Math.max(1, Math.min(250, Number(result.itemsPerPage) || configuredPageSize()));
    await api('/api/settings', { method: 'PUT', body: JSON.stringify({ views: { collections: { cardSize, itemsPerPage } } }) }).catch(() => {});
    settings.views = settings.views || {};
    settings.views.collections = { ...(settings.views.collections || {}), cardSize, itemsPerPage };
    updateControlsState();
    render();
  }

  function emptyMarkup() {
    if (!items.length) {
      return `<div class="grid-empty grid-empty--rich"><strong>Todavía no hay colecciones</strong><p>Marca elementos del backlog como vistos o terminados para construir esta vista.</p></div>`;
    }
    return `<div class="grid-empty grid-empty--rich"><strong>No hay resultados con estos filtros</strong><p>Prueba a activar más tipos o cambia la búsqueda actual.</p></div>`;
  }


  function listMarkup(rows = []) {
    return `<div class="kiosko-list" role="table">
      <div class="kiosko-list__row kiosko-list__row--head" role="row"><span>Título</span><span>Fuente</span><span>Tipo</span><span>Rating</span><span>Fecha</span></div>
      ${rows.map(item => `<button type="button" class="kiosko-list__row" data-id="${escapeAttr(item.id)}" data-source="${escapeAttr(item.source || '')}"><span><strong>${escapeHtml(item.title || 'Sin título')}</strong><small>${escapeHtml(item.subtitle || '')}</small></span><span>${escapeHtml(item.source || '')}</span><span>${escapeHtml(typeLabelForList(item))}</span><span>${ratingFor(item) ? ratingFor(item) : '—'}</span><span>${escapeHtml(new Date(item.completedAt || item.lastActivityAt || item.updatedAt || item.createdAt || '').toLocaleDateString('es-ES'))}</span></button>`).join('')}
    </div>`;
  }

  function render() {
    if (!el || !isVisible) return;
    const { rows, total, pages } = visible();
    el.querySelector('[data-section-count]').textContent = `${total}`; const title = el.querySelector('.section-title'); if (title) { let node = title.querySelector('[data-active-filter-chips]'); if (!node) { node = document.createElement('div'); node.dataset.activeFilterChips = '1'; title.appendChild(node); } node.innerHTML = activeFiltersMarkup(); let typeNode = title.querySelector('[data-type-filter-bar]'); if (!typeNode) { typeNode = document.createElement('div'); typeNode.dataset.typeFilterBar = '1'; title.appendChild(typeNode); } typeNode.innerHTML = typeFilterBarMarkup(); }
    const pager = el.querySelector('.pager');
    pager.hidden = pages <= 1;
    el.querySelector('[data-page-label]').textContent = `${page + 1}/${pages}`;
    el.querySelector('[data-prev]').disabled = page <= 0;
    el.querySelector('[data-next]').disabled = page >= pages - 1;
    updateControlsState();
    const grid = el.querySelector('.media-grid');
    grid.classList.toggle('media-grid--list', viewMode === 'list'); const cfg = sizeMap[currentSize()];
    grid.style.setProperty('--card-width', `${cfg.width}px`); grid.style.setProperty('--card-gap', `${cfg.gap}px`); grid.style.setProperty('--card-poster-size', `${cfg.poster}px`); grid.style.setProperty('--mobile-columns', String(cfg.mobileColumns));
    if (!rows.length) { grid.innerHTML = emptyMarkup(); restartBackgroundRotation(); saveSession(); return; }
    if (viewMode === 'list') { grid.innerHTML = listMarkup(rows); restartBackgroundRotation(); saveSession(); return; }
    grid.innerHTML = rows.map(item => {
      const bg = item.backdrop || item.poster || '';
      return `<article class="media-card media-card--rich completed-card" data-id="${escapeAttr(item.id)}" data-source="${escapeAttr(item.source)}">
        ${bg ? `<div class="media-card__bg" style="background-image:url('${escapeAttr(bg)}')"></div>` : ''}
        <div class="media-card__surface">
          <div class="media-card__poster">${item.poster ? `<img src="${escapeAttr(item.poster)}" alt="">` : `<div class="media-card__fallback">${escapeHtml((item.title || '?').slice(0,1))}</div>`}</div>
          <div class="media-card__meta">
            <strong>${escapeHtml(item.title || 'Sin título')}</strong>
            <span>${escapeHtml(item.subtitle || label(item.collectionType))}</span>
            <div class="media-card__completion">${stars(item.rating)}<time>${escapeHtml(date(item.completedAt))}</time></div>
            ${cardGroupsMarkup(item)}
          </div>
        </div>
      </article>`;
    }).join('');
    restartBackgroundRotation();
    saveSession();
  }

  function find(id) { return items.find(item => item.id === id); }
  async function editItem(item) {
    return openItemDetail({
      ui,
      api,
      item,
      context: 'collections',
      toast: message => ui.toast(message),
      collectionGroups,
      settings
    });
  }

  return {
    id: 'collections',
    mount(target) {
      el = target;
      loadSession();
      el.innerHTML = `<div class="app-section collections-view"><div class="section-bg" data-dynamic-bg></div><header class="section-title"><h1>Colecciones <span data-section-count>0</span></h1></header><section class="media-grid" aria-label="Colecciones"></section><footer class="pager"><button data-prev aria-label="Página anterior">‹</button><span data-page-label>1/1</span><button data-next aria-label="Página siguiente">›</button></footer></div>`;
      el.addEventListener('click', async event => {
        if (event.target.closest('[data-prev]')) { page -= 1; render(); return; }
        if (event.target.closest('[data-next]')) { page += 1; render(); return; }
        const typeButton = event.target.closest('[data-toggle-type]');
        if (typeButton) { const type = typeButton.dataset.toggleType; if (activeTypes.has(type)) activeTypes.delete(type); else activeTypes.add(type); if (activeTypes.size < 1) activeTypes = new Set(['games','movies','series']); page = 0; render(); return; }
        const clearGroup = event.target.closest('[data-clear-group]');
        if (clearGroup) { activeGroupIds.delete(clearGroup.dataset.clearGroup); page = 0; render(); return; }
        const groupMatchButton = event.target.closest('[data-group-match-set]');
        if (groupMatchButton) { groupMatch = groupMatchButton.dataset.groupMatchSet || 'any'; page = 0; render(); return; }
        const chip = event.target.closest('[data-group-chip]');
        if (chip) { activeGroupIds = new Set([chip.dataset.groupChip]); groupMatch = 'any'; page = 0; render(); return; }
        const card = event.target.closest('[data-id]'); if (card) { const item = find(card.dataset.id); if (item) await editItem(item); }
      });
      controlsRoot?.addEventListener('click', event => {
        if (!isVisible) return;
        if (event.target.closest('[data-collection-open-controls]')) openControlsModal();
      });
      window.addEventListener('resize', () => { if (isVisible) render(); });
      window.addEventListener('kiosko:collection-groups-changed', async () => { await refreshCollectionGroups(); if (isVisible) render(); });
      window.addEventListener('kiosko:collections-changed', async () => { await refreshCollectionGroups(); if (isVisible) render(); });
      document.addEventListener('click', event => { const btn = event.target.closest('.rating-picker button'); if (!btn) return; const picker = btn.closest('.rating-picker'); picker.dataset.value = btn.dataset.rating; picker.querySelectorAll('button').forEach(node => { node.textContent = Number(node.dataset.rating) <= Number(btn.dataset.rating) ? '★' : '☆'; }); });
    },
    show() { isVisible = true; controlsMounted = false; el.classList.add('view--active'); el.setAttribute('aria-hidden', 'false'); renderControls({ force: true }); render(); },
    hide() { isVisible = false; clearInterval(bgTimer); controlsMounted = false; el.classList.remove('view--active'); el.setAttribute('aria-hidden', 'true'); if (controlsRoot) controlsRoot.innerHTML = ''; },
    update(data = {}) { if (Array.isArray(data.completions)) items = data.completions; if (Array.isArray(data.collectionGroups)) { collectionGroups = data.collectionGroups; activeGroupIds = new Set([...activeGroupIds].filter(id => collectionGroups.some(group => group.id === id))); controlsMounted = false; } if (data.settings) { settings = data.settings; cardSize = settings.views?.collections?.cardSize || cardSize; } if (isVisible) render(); }
  };
}
function clamp(value, min, max, fallback) { const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
