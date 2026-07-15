export function createCollectionsView({ api, ui, controlsRoot } = {}) {
  let el;
  let items = [];
  let settings = {};
  let activeTypes = new Set(['games', 'movies', 'series']);
  let cardSize = 'medium';
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
  function stars(value = 0) { const n = Math.max(0, Math.min(5, Number(value) || 0)); return `<span class="star-rating">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`; }
  function date(value) { const d = new Date(value); return Number.isFinite(d.getTime()) ? d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : ''; }
  function configuredPageSize() { return clamp(Number(settings.views?.collections?.itemsPerPage), 1, 120, 12); }
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


  function sessionKey() { return 'kiosko:v5.5:collections'; }
  function saveSession() { try { sessionStorage.setItem(sessionKey(), JSON.stringify({ activeTypes: [...activeTypes], search, page, cardSize })); } catch {} }
  function loadSession() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(sessionKey()) || sessionStorage.getItem('kiosko:v5.4.2:collections') || sessionStorage.getItem('kiosko:v5.4:collections') || 'null');
      if (!parsed) return;
      if (Array.isArray(parsed.activeTypes)) activeTypes = new Set(parsed.activeTypes.filter(type => ['games','movies','series'].includes(type)));
      if (typeof parsed.search === 'string') search = parsed.search;
      if (Number.isFinite(Number(parsed.page))) page = Math.max(0, Number(parsed.page));
      if (['small','medium','large'].includes(parsed.cardSize)) cardSize = parsed.cardSize;
    } catch {}
  }

  function countsByType() {
    return items.reduce((acc, item) => { const type = item.collectionType; if (['games','movies','series'].includes(type)) acc[type] = (acc[type] || 0) + 1; return acc; }, { games: 0, movies: 0, series: 0 });
  }

  function filtered() {
    const q = search.trim().toLowerCase();
    return items
      .filter(item => activeTypes.has(item.collectionType))
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

  function renderControls({ force = false } = {}) {
    if (!controlsRoot || !isVisible) return;
    if (!force && controlsMounted) return;
    controlsMounted = true;
    controlsRoot.innerHTML = `<button type="button" class="view-actions-button view-filter-button" data-collection-open-controls aria-label="Filtros y vista"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v2H4V6Zm3 5h10v2H7v-2Zm3 5h4v2h-4v-2Z"/></svg><span class="view-filter-button__label">Filtros</span><span class="view-filter-button__meta" data-collection-filter-meta></span></button>`;
    updateControlsState();
  }

  function updateControlsState() {
    if (!controlsRoot || !isVisible) return;
    const meta = controlsRoot.querySelector('[data-collection-filter-meta]');
    if (meta) meta.textContent = `${activeTypes.size}/3 · ${currentSize().slice(0,1).toUpperCase()}`;
  }

  async function openControlsModal() {
    const counts = countsByType();
    const body = `<div class="controls-modal">
      <section class="controls-modal__section"><h3>Tipos</h3><div class="controls-modal__checks">
        ${['games','movies','series'].map(type => `<label class="controls-modal__toggle"><input type="checkbox" data-filter-type="${type}" ${activeTypes.has(type) ? 'checked' : ''}><span>${typeLabels[type]}</span><small>${counts[type] || 0}</small></label>`).join('')}
      </div></section>
      <section class="controls-modal__section"><h3>Tamaño de carátula</h3><div class="controls-modal__sizes">
        ${[['small','S'],['medium','M'],['large','L']].map(([value,label]) => `<label class="controls-modal__toggle"><input type="radio" name="collection-size" value="${value}" ${currentSize() === value ? 'checked' : ''}><span>${label}</span></label>`).join('')}
      </div></section>
      <section class="controls-modal__section"><h3>Búsqueda</h3><label class="ui-field"><span>Filtrar por título o detalle</span><input type="search" data-control-search value="${escapeAttr(search)}" placeholder="Buscar" autocomplete="off"></label></section>
    </div>`;
    const result = await ui.open({
      title: 'Vista de Colecciones',
      body,
      actions: [
        { label: 'Cancelar', value: null },
        { label: 'Aplicar', variant: 'primary', onClick: root => ({
          activeTypes: [...root.querySelectorAll('[data-filter-type]:checked')].map(input => input.dataset.filterType),
          cardSize: root.querySelector('input[name="collection-size"]:checked')?.value || currentSize(),
          search: root.querySelector('[data-control-search]')?.value || ''
        }) }
      ]
    });
    if (!result) return;
    activeTypes = new Set(result.activeTypes.filter(type => ['games','movies','series'].includes(type)));
    if (activeTypes.size < 1) activeTypes = new Set(['games','movies','series']);
    cardSize = ['small','medium','large'].includes(result.cardSize) ? result.cardSize : 'medium';
    search = result.search || '';
    page = 0;
    await api('/api/settings', { method: 'PUT', body: JSON.stringify({ views: { collections: { cardSize } } }) }).catch(() => {});
    updateControlsState();
    render();
  }

  function emptyMarkup() {
    if (!items.length) {
      return `<div class="grid-empty grid-empty--rich"><strong>Todavía no hay colecciones</strong><p>Marca elementos del backlog como vistos o terminados para construir esta vista.</p></div>`;
    }
    return `<div class="grid-empty grid-empty--rich"><strong>No hay resultados con estos filtros</strong><p>Prueba a activar más tipos o cambia la búsqueda actual.</p></div>`;
  }

  function render() {
    if (!el || !isVisible) return;
    const { rows, total, pages } = visible();
    el.querySelector('[data-section-count]').textContent = `${total}`;
    const pager = el.querySelector('.pager');
    pager.hidden = pages <= 1;
    el.querySelector('[data-page-label]').textContent = `${page + 1}/${pages}`;
    el.querySelector('[data-prev]').disabled = page <= 0;
    el.querySelector('[data-next]').disabled = page >= pages - 1;
    updateControlsState();
    const grid = el.querySelector('.media-grid'); const cfg = sizeMap[currentSize()];
    grid.style.setProperty('--card-width', `${cfg.width}px`); grid.style.setProperty('--card-gap', `${cfg.gap}px`); grid.style.setProperty('--card-poster-size', `${cfg.poster}px`); grid.style.setProperty('--mobile-columns', String(cfg.mobileColumns));
    if (!rows.length) { grid.innerHTML = emptyMarkup(); restartBackgroundRotation(); saveSession(); return; }
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
          </div>
        </div>
      </article>`;
    }).join('');
    restartBackgroundRotation();
    saveSession();
  }

  function find(id) { return items.find(item => item.id === id); }
  async function editItem(item) {
    const rating = await ui.open({
      title: 'Editar valoración',
      className: 'ui-modal-root--rating',
      body: `<div class="rating-modal"><div class="rating-modal__poster">${item.poster ? `<img src="${escapeAttr(item.poster)}" alt="">` : ''}</div><div class="rating-modal__copy"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(label(item.collectionType))}</p><fieldset class="rating-picker" data-value="${Number(item.rating||0)}">${[1,2,3,4,5].map(n => `<button type="button" data-rating="${n}">${n <= Number(item.rating||0) ? '★' : '☆'}</button>`).join('')}</fieldset></div></div>`,
      actions: [
        { label: 'Eliminar', variant: 'danger', onClick: async () => { const ok = await ui.confirm({ title: 'Eliminar de colección', message: '¿Eliminar este elemento?', confirmText: 'Eliminar', danger: true }); if (!ok) return false; await api(`/api/completions/${item.id}`, { method: 'DELETE' }); return null; } },
        { label: 'Cancelar', value: null },
        { label: 'Guardar', variant: 'primary', onClick: (root) => Number(root.querySelector('.rating-picker')?.dataset.value || item.rating || 0) }
      ]
    });
    if (rating === null) return;
    await api(`/api/completions/${item.id}`, { method: 'PATCH', body: JSON.stringify({ rating }) }); ui.toast('Valoración actualizada');
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
        const card = event.target.closest('.media-card'); if (card) { const item = find(card.dataset.id); if (item) await editItem(item); }
      });
      controlsRoot?.addEventListener('click', event => {
        if (!isVisible) return;
        if (event.target.closest('[data-collection-open-controls]')) openControlsModal();
      });
      window.addEventListener('resize', () => { if (isVisible) render(); });
      document.addEventListener('click', event => { const btn = event.target.closest('.rating-picker button'); if (!btn) return; const picker = btn.closest('.rating-picker'); picker.dataset.value = btn.dataset.rating; picker.querySelectorAll('button').forEach(node => { node.textContent = Number(node.dataset.rating) <= Number(btn.dataset.rating) ? '★' : '☆'; }); });
    },
    show() { isVisible = true; controlsMounted = false; el.classList.add('view--active'); el.setAttribute('aria-hidden', 'false'); renderControls({ force: true }); render(); },
    hide() { isVisible = false; clearInterval(bgTimer); controlsMounted = false; el.classList.remove('view--active'); el.setAttribute('aria-hidden', 'true'); if (controlsRoot) controlsRoot.innerHTML = ''; },
    update(data = {}) { if (Array.isArray(data.completions)) items = data.completions; if (data.settings) { settings = data.settings; cardSize = settings.views?.collections?.cardSize || cardSize; } if (isVisible) render(); }
  };
}
function clamp(value, min, max, fallback) { const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
