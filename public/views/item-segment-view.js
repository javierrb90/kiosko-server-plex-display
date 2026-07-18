import { openItemDetail } from '../core/item-detail.js';
import { escapeHtml, escapeAttr, clamp, typeFor, searchHaystack, itemMatchesGroup, backdropFor } from '../core/item-utils.js';
import { itemCardMarkup, itemListMarkup, activeFilterChipsMarkup, paginationMarkup } from '../core/item-renderer.js';

const TYPE_LABELS = { games: 'Juegos', movies: 'Películas', series: 'Series' };
const STATUS_LABELS = { '': 'Todos', known: 'Base', backlog: 'Backlog', 'on-deck': 'On Deck', completed: 'Colección' };
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
  let search = localStorage.getItem('bbqueue:global-search') || '';
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
  let searchDebounce = 0;

  function sessionKey() { return `kiosko:v6.8:${id}`; }
  function saveSession() {
    try { localStorage.setItem(sessionKey(), JSON.stringify({ search, activeTypes: [...activeTypes], activeGroupIds: [...activeGroupIds], groupMatch, source, status, sort, direction, viewMode, cardSize, cardFormat, includeCharred, limit })); } catch {}
  }
  function loadSession() {
    try {
      const incomingSearch = localStorage.getItem('bbqueue:global-search') || '';
      const parsed = JSON.parse(localStorage.getItem(sessionKey()) || 'null');
      if (!parsed) { if (incomingSearch) search = incomingSearch; return; }
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
      if (incomingSearch) search = incomingSearch;
    } catch {}
  }
  function availableTypes() {
    const ids = customTypesFromSettings(settings).map(type => type.id);
    for (const item of allItems) if (item?.collectionType && !ids.includes(item.collectionType)) ids.push(item.collectionType);
    return ids;
  }
  function ensureActiveTypes() {
    const ids = availableTypes();
    activeTypes = new Set([...activeTypes].filter(type => ids.includes(type)));
    if (!activeTypes.size) applyWorkspaceTypes();
  }
  function workspaceKey(){ return id === 'on-deck' ? 'onDeck' : id; }
  function workspaceConfig(){ return settings?.workspaces?.[workspaceKey()] || {}; }
  function workspaceVisibleTypes(){ const configured=workspaceConfig().visibleTypes; return Array.isArray(configured) && configured.length ? configured : availableTypes(); }
  function applyWorkspaceTypes(){ activeTypes = new Set(workspaceVisibleTypes().filter(type => availableTypes().includes(type))); if (!activeTypes.size) activeTypes = new Set(availableTypes()); }
  function currentSize() { return cardSize || workspaceConfig().cardSize || settings?.views?.[id]?.cardSize || 'medium'; }
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
      .filter(item => charredOnly ? Boolean(item.grill?.charred || item.states?.charred) : true)
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
    const grouping = workspaceConfig().grouping || (groupByDate ? 'lastActivity' : 'none');
    const effectiveGroupByDate = grouping === 'lastActivity' || grouping === 'completedAt';
    if (!effectiveGroupByDate) return viewMode === 'list' ? itemListMarkup(rows, { context: id, groups: collectionGroups }) : rows.map(item => itemCardMarkup(item, { context: id, groups: collectionGroups, format: cardFormat, visibility: settings?.design?.gridCards?.[cardFormat] || {} })).join('');
    const today = new Date(); today.setHours(0,0,0,0);
    const one = 86400000;
    const labelFor = item => {
      const raw = grouping === 'completedAt' ? item.completedAt : (item.lastActivityAt || item.updatedAt || item.createdAt);
      const t = Date.parse(raw || '');
      if (!Number.isFinite(t)) return 'ANTERIOR';
      if (t >= today.getTime()) return 'HOY';
      if (t >= today.getTime() - one) return 'AYER';
      if (t >= today.getTime() - one * 7) return 'ÚLTIMA SEMANA';
      return 'ANTERIOR';
    };
    const order = ['HOY','AYER','ÚLTIMA SEMANA','ANTERIOR'];
    const buckets = new Map(order.map(label => [label, []]));
    for (const item of rows) buckets.get(labelFor(item)).push(item);
    return order.map(label => {
      const items = buckets.get(label);
      if (!items.length) return '';
      const markup = viewMode === 'list'
        ? itemListMarkup(items, { context: id, groups: collectionGroups })
        : items.map(item => itemCardMarkup(item, { context: id, groups: collectionGroups, format: cardFormat, visibility: settings?.design?.gridCards?.[cardFormat] || {} })).join('');
      return `<div class="media-date-heading">${escapeHtml(label)}</div>${markup}`;
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
    const localRoot = el?.querySelector('[data-section-controls]');
    if (!force && controlsMounted) return;
    controlsMounted = true;
    controlsRoot.innerHTML = `<div class="collection-toolbar collection-toolbar--global"><label class="collection-search"><input type="search" data-quick-search value="${escapeAttr(search)}" placeholder="Buscar en todos los espacios" autocomplete="off"></label><button type="button" class="view-actions-button view-filter-button global-charred-filter ${charredOnly?'is-active':''}" data-global-charred title="Mostrar solo achicharrados"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2s.8 3.2-1.8 5.8c-1.8 1.8-3.2 3.6-2.7 6.1.3 1.6 1.5 2.7 3 3.1-1.1-1.4-.7-3.4.5-4.5 1.5-1.4 1.8-2.8 1.7-4.1 2.7 2 4.8 4.7 4.8 8 0 3.1-2.5 5.6-5.7 5.6S7.5 19.5 7.5 16.4C7.5 10.1 13.5 8.2 13.5 2Z"/></svg><strong data-global-charred-count>${allItems.filter(item=>item.grill?.charred || item.states?.charred).length}</strong></button></div>`;
    if (localRoot) localRoot.innerHTML = `<div class="workspace-toolbar"><button type="button" class="view-actions-button view-filter-button ${activeGroupIds.size ? 'is-active' : ''}" data-open-filters title="Filtrar por grupos"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16l-6.2 7.1V19l-3.6 1v-7.9L4 5Z"/></svg><span class="view-filter-button__label">Filtros</span>${activeGroupIds.size ? `<strong class="workspace-toolbar__badge">${activeGroupIds.size}</strong>` : ''}</button><button type="button" class="view-actions-button view-filter-button view-mode-icon" data-toggle-view title="${viewMode === 'grid' ? 'Ver como lista' : 'Ver como cuadrícula'}" aria-label="${viewMode === 'grid' ? 'Ver como lista' : 'Ver como cuadrícula'}">${viewMode === 'grid' ? '<svg viewBox="0 0 24 24"><path d="M4 5h16v2H4zm0 6h16v2H4zm0 6h16v2H4z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z"/></svg>'}</button><button type="button" class="view-actions-button view-filter-button" data-open-controls title="Configurar espacio de trabajo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17.25V20h2.75L17.81 8.94l-2.75-2.75L4 17.25Zm15.71-10.04a1.003 1.003 0 0 0 0-1.42l-1.5-1.5a1.003 1.003 0 0 0-1.42 0l-1.17 1.17 2.75 2.75 1.34-1Z"/></svg><span class="view-filter-button__label">Configurar</span></button></div>`;
    controlsRoot.querySelector('[data-quick-search]')?.addEventListener('input', event => {
      search = event.target.value || '';
      localStorage.setItem('bbqueue:global-search', search);
      page = 1;
      window.clearTimeout(searchDebounce);
      searchDebounce = window.setTimeout(() => {
        applyFilters(); render(); saveSession();
        window.dispatchEvent(new CustomEvent('bbqueue:global-search', { detail: { value: search, source: id } }));
      }, 220);
    });
    controlsRoot.querySelector('[data-global-charred]')?.addEventListener('click', () => { charredOnly=!charredOnly; localStorage.setItem('bbqueue:charred-only',charredOnly?'1':'0'); window.dispatchEvent(new CustomEvent('bbqueue:charred-filter',{detail:charredOnly})); renderControls({force:true}); render(); });
    localRoot?.querySelector('[data-toggle-view]')?.addEventListener('click', () => { viewMode = viewMode === 'grid' ? 'list' : 'grid'; renderControls({ force: true }); render(); saveSession(); });
    localRoot?.querySelector('[data-open-filters]')?.addEventListener('click', openFiltersModal);
    localRoot?.querySelector('[data-open-controls]')?.addEventListener('click', openControlsModal);
    updateControlsState();
  }
  function updateControlsState() {
    const localRoot = el?.querySelector('[data-section-controls]');
    localRoot?.querySelector('[data-open-filters]')?.classList.toggle('is-active', activeGroupIds.size > 0);
  }
  function bindPanelEditorNavigation() {
    setTimeout(() => {
      const root = [...document.querySelectorAll('.ui-modal-root--workspace')].at(-1);
      const scroller = root?.querySelector('.panel-editor__scroll');
      const buttons = [...(root?.querySelectorAll('[data-panel-jump]') || [])];
      if (!root || !scroller || !buttons.length) return;
      const sections = buttons.map(button => root.querySelector(`#${button.dataset.panelJump}`)).filter(Boolean);
      const update = () => { const top=scroller.getBoundingClientRect().top+70; let active=sections[0]; for(const section of sections){ if(section.getBoundingClientRect().top<=top) active=section; } buttons.forEach(button=>button.classList.toggle('is-active',button.dataset.panelJump===active?.id)); };
      buttons.forEach(button=>button.addEventListener('click',()=>root.querySelector(`#${button.dataset.panelJump}`)?.scrollIntoView({behavior:'smooth',block:'start'})));
      scroller.addEventListener('scroll',update,{passive:true}); update();
    },0);
  }
  async function openFiltersModal() {
    const body = `<div class="panel-editor panel-editor--filters"><nav class="panel-editor__anchors"><button type="button" class="is-active" data-panel-jump="filter-groups">Grupos</button></nav><div class="panel-editor__scroll">
      <section id="filter-groups" class="panel-editor__section"><header><span>Filtros temporales</span><h3>Grupos</h3><p>Los grupos son etiquetas transversales; no son la Colección.</p></header><div class="segmented-control"><label><input type="radio" name="group-match" value="any" ${groupMatch === 'any' ? 'checked' : ''}><span>Cualquiera</span></label><label><input type="radio" name="group-match" value="all" ${groupMatch === 'all' ? 'checked' : ''}><span>Todos</span></label></div><div class="controls-modal__checks">${collectionGroups.length ? collectionGroups.map(group => `<label class="controls-modal__toggle"><input type="checkbox" data-filter-group="${escapeAttr(group.id)}" ${activeGroupIds.has(group.id) ? 'checked' : ''}><span>${escapeHtml(group.name)}</span><small>${escapeHtml(group.mode || 'manual')}</small></label>`).join('') : '<p class="settings-help">No hay grupos creados.</p>'}</div></section>
    </div></div>`;
    const modalPromise = ui.open({ title: `${title} · filtros`, className: 'ui-modal-root--workspace ui-modal-root--filters', body, actions: [{ label: 'Limpiar', value: '__clear__' }, { label: 'Cerrar', variant: 'primary', onClick: root => ({ activeGroupIds:[...root.querySelectorAll('[data-filter-group]:checked')].map(input=>input.dataset.filterGroup), groupMatch:root.querySelector('input[name="group-match"]:checked')?.value||'any' }) }] });
    bindPanelEditorNavigation();
    const result = await modalPromise;
    if (!result) return;
    if (result === '__clear__') { activeGroupIds=new Set(); groupMatch='any'; }
    else { activeGroupIds=new Set(result.activeGroupIds||[]); groupMatch=result.groupMatch; }
    page=1; applyFilters(); renderControls({force:true}); render(); saveSession();
  }
  async function openControlsModal() {
    const ws = workspaceConfig();
    const grouping = ws.grouping || (groupByDate ? 'lastActivity' : 'none');
    const body = `<div class="panel-editor"><nav class="panel-editor__anchors"><button type="button" class="is-active" data-panel-jump="workspace-presentation">Presentación</button><button type="button" data-panel-jump="workspace-organization">Organización</button></nav><div class="panel-editor__scroll">
      <section id="workspace-presentation" class="panel-editor__section"><header><span>Espacio de trabajo</span><h3>Presentación</h3><p>Configuración persistente de ${escapeHtml(title)}.</p></header><div class="workspace-visible-types"><h4>Tipos visibles</h4><p class="settings-help">Define qué tipos forman parte de este espacio de trabajo.</p><div class="controls-modal__checks">${availableTypes().map(type => `<label class="controls-modal__toggle"><input type="checkbox" data-workspace-type="${escapeAttr(type)}" ${activeTypes.has(type) ? 'checked' : ''}><span>${escapeHtml(typePluralLabel(type, settings))}</span></label>`).join('')}</div></div><div class="setting-choice-grid"><label><input type="radio" name="view-mode" value="grid" ${viewMode==='grid'?'checked':''}><span><strong>Grid</strong><small>Tarjetas visuales</small></span></label><label><input type="radio" name="view-mode" value="list" ${viewMode==='list'?'checked':''}><span><strong>Lista</strong><small>Filas compactas</small></span></label></div><div class="setting-choice-grid setting-choice-grid--three">${[['small','Pequeño'],['medium','Mediano'],['large','Grande']].map(([value,label])=>`<label><input type="radio" name="size" value="${value}" ${currentSize()===value?'checked':''}><span><strong>${label}</strong><small>Tamaño de tarjeta</small></span></label>`).join('')}</div><div class="setting-choice-grid"><label><input type="radio" name="card-format" value="simple" ${cardFormat==='simple'?'checked':''}><span><strong>Simple</strong><small>Carátula protagonista</small></span></label><label><input type="radio" name="card-format" value="standard" ${cardFormat==='standard'?'checked':''}><span><strong>Normal</strong><small>Carátula e información</small></span></label></div><label class="ui-field"><span>Items por página</span><input data-items-per-page type="number" min="6" max="500" value="${escapeAttr(limit)}"></label></section>
      <section id="workspace-organization" class="panel-editor__section"><header><span>Espacio de trabajo</span><h3>Organización</h3></header><label class="ui-field"><span>Agrupar por</span><select data-control-grouping><option value="none" ${grouping==='none'?'selected':''}>Sin agrupación</option><option value="lastActivity" ${grouping==='lastActivity'?'selected':''}>Última actividad</option><option value="completedAt" ${grouping==='completedAt'?'selected':''}>Fecha de finalización</option><option value="type" ${grouping==='type'?'selected':''}>Tipo</option><option value="group" ${grouping==='group'?'selected':''}>Grupo</option></select></label><label class="ui-field"><span>Ordenar por</span><select data-control-sort>${[['lastActivityAt','Última actividad'],['firstSeenAt','Entrada en base de datos'],['updatedAt','Actualización'],['title','Título'],['rating','Calificación'],['completedAt','Finalización']].map(([value,label])=>`<option value="${value}" ${sort===value?'selected':''}>${label}</option>`).join('')}</select></label><div class="segmented-control"><label><input type="radio" name="direction" value="desc" ${direction==='desc'?'checked':''}><span>Descendente</span></label><label><input type="radio" name="direction" value="asc" ${direction==='asc'?'checked':''}><span>Ascendente</span></label></div></section>
    </div></div>`;
    const modalPromise = ui.open({ title: `${title} · configuración`, className: 'ui-modal-root--workspace', body, actions: [{ label:'Cancelar',value:null },{ label:'Guardar',variant:'primary',onClick:root=>({ visibleTypes:[...root.querySelectorAll('[data-workspace-type]:checked')].map(input=>input.dataset.workspaceType), viewMode:root.querySelector('input[name="view-mode"]:checked')?.value||viewMode, cardSize:root.querySelector('input[name="size"]:checked')?.value||cardSize, cardFormat:root.querySelector('input[name="card-format"]:checked')?.value||cardFormat, limit:clamp(root.querySelector('[data-items-per-page]')?.value,6,500,limit), grouping:root.querySelector('[data-control-grouping]')?.value||grouping, sort:root.querySelector('[data-control-sort]')?.value||sort, direction:root.querySelector('input[name="direction"]:checked')?.value||direction }) }] });
    bindPanelEditorNavigation();
    const result = await modalPromise;
    if(!result)return; activeTypes=new Set(result.visibleTypes?.length ? result.visibleTypes : availableTypes()); viewMode=result.viewMode; cardSize=result.cardSize; cardFormat=result.cardFormat; limit=result.limit; sort=result.sort; direction=result.direction; page=1; applyFilters(); renderControls({force:true}); render(); saveSession();
    const key=workspaceKey(); const existing=settings?.workspaces?.[key]||{}; const workspacePatch={...existing,visibleTypes:[...activeTypes],grouping:result.grouping,sort,direction,cardSize,cardFormat,viewMode,itemsPerPage:limit};
    try { settings=await api('/api/settings',{method:'PUT',body:JSON.stringify({workspaces:{[key]:workspacePatch},views:{[id]:{...(settings?.views?.[id]||{}),cardSize,cardFormat,itemsPerPage:limit}}})}); } catch(error){ ui.toast('No se pudo guardar el espacio de trabajo',{detail:error.message||''}); }
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
          <div><strong>Nuevo item</strong><small>Creado manualmente en BBQueue</small></div>
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
    const charredCount = allItems.filter(item => item.grill?.charred || item.states?.charred).length;
    const charredButton = el.querySelector('[data-toggle-charred]'); if (charredButton) { charredButton.hidden = !charredCount; charredButton.classList.toggle('is-active', charredOnly); const node=charredButton.querySelector('[data-charred-count]'); if(node) node.textContent=String(charredCount); }
    const count = el.querySelector('[data-section-count]');
    if (count) count.textContent = String(total);
    const chips = el.querySelector('[data-active-filter-chips]');
    if (chips) chips.innerHTML = activeFilterChipsMarkup({ activeTypes, activeGroupIds, groups: collectionGroups, source, status: allowStatus ? status : '', search, groupMatch });
    const grid = el.querySelector('[data-items-grid]');
    if (!grid) return;
    const resolvedSize = currentSize();
    grid.className = viewMode === 'list' ? `media-grid media-grid--list unified-grid card-size-${resolvedSize}` : `media-grid unified-grid card-format-${cardFormat} card-size-${resolvedSize}`;
    const size = SIZE_MAP[resolvedSize] || SIZE_MAP.medium;
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
    if (view === 'collections') return item.status === 'completed' || item.states?.completed === true || Boolean(item.completedAt);
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
      el.innerHTML = `<div class="app-section ${id}-view unified-view"><div class="section-bg" data-dynamic-bg><div class="section-bg__image is-visible"></div></div><header class="section-title"><div class="section-title__row"><div class="section-title__main"><h1>${escapeHtml(title)} <span data-section-count>0</span></h1>${id === 'database' ? '<button type="button" class="section-title__add" data-create-manual-item title="Crear item">＋</button>' : ''}</div><div class="section-title__controls" data-section-controls></div></div><div data-active-filter-chips></div></header><main class="unified-view__content"><div class="media-grid unified-grid" data-items-grid></div></main><footer class="unified-view__footer" data-pagination></footer></div>`;
      charredOnly = localStorage.getItem('bbqueue:charred-only') === '1';
      window.addEventListener('bbqueue:global-search', event => {
        const detail = event.detail;
        const value = typeof detail === 'object' && detail ? detail.value : detail;
        const sourceView = typeof detail === 'object' && detail ? detail.source : '';
        if (sourceView === id) return;
        search = String(value || '');
        page = 1;
        if (isVisible) { renderControls({ force: true }); render(); }
      });
      window.addEventListener('bbqueue:charred-filter', event => { charredOnly=Boolean(event.detail); page=1; if(isVisible){renderControls({force:true});render();} });
      el.addEventListener('click', event => {
        if (event.target.closest('[data-page-prev]')) { page = Math.max(1, page - 1); render(); saveSession(); return; }
        if (event.target.closest('[data-page-next]')) { page = Math.min(pages, page + 1); render(); saveSession(); return; }
        if (event.target.closest('[data-create-manual-item]')) { openCreateManualItem(); return; }
        const removeGroup = event.target.closest('[data-remove-group-filter]');
        if (removeGroup) { activeGroupIds.delete(removeGroup.dataset.removeGroupFilter); page=1; applyFilters(); renderControls({force:true}); render(); saveSession(); return; }
        
        const item = findItemFromEvent(event);
        if (item) openItem(item);
      });
    },
    show() { isVisible = true; applyWorkspaceTypes(); el?.classList.add('view--active'); el?.classList.remove('view--render-hidden'); el?.setAttribute('aria-hidden', 'false'); renderControls({ force: true }); load(); },
    hide() { isVisible = false; controlsMounted = false; if (controlsRoot) controlsRoot.innerHTML = ''; el?.classList.remove('view--active'); el?.setAttribute('aria-hidden', 'true'); },
    update(payload = {}) {
      if (payload.collectionGroups) collectionGroups = payload.collectionGroups;
      if (payload.settings) { settings = payload.settings; const ws=workspaceConfig(); if(ws.sort) sort=ws.sort; if(ws.cardSize) cardSize=ws.cardSize; if(ws.cardFormat) cardFormat=ws.cardFormat; applyWorkspaceTypes(); }
      if (payload.item) applyItemUpdate(payload.item);
      if (payload.refresh && isVisible) load();
      else if (isVisible && !payload.item) render();
    },
    refresh() { return load(); }
  };
}
