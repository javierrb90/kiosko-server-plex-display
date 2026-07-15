export function createBacklogView({ api, ui, controlsRoot } = {}) {
  let el;
  let backlog = { plex: [], playnite: [] };
  let ratings = {};
  let settings = {};
  let activeTypes = new Set(['movies', 'games', 'series']);
  let cardSize = 'medium';
  let search = '';
  let page = 0;
  let isVisible = false;
  let bgTimer = null;
  let bgIndex = 0;
  let controlsMounted = false;

  const sizeMap = {
    small: { width: 104, gap: 12 },
    medium: { width: 136, gap: 14 },
    large: { width: 176, gap: 16 }
  };
  const typeLabels = { movies: 'Películas', games: 'Juegos', series: 'Series' };

  function currentSize() { return ['small','medium','large'].includes(cardSize) ? cardSize : 'medium'; }
  function sourceLabel(source) { return source === 'plex' ? 'Plex' : source === 'playnite' ? 'Playnite' : source; }
  function typeFor(item) { return ['movies','games','series'].includes(item.collectionType) ? item.collectionType : (item.source === 'playnite' ? 'games' : 'series'); }
  function labelForItem(item) { return typeLabels[typeFor(item)] || sourceLabel(item.source); }
  function actionLabel(item) { return item.source === 'plex' ? 'Marcar como visto' : 'Marcar como terminado'; }
  function stars(value = 0) { const n = Math.max(0, Math.min(5, Number(value) || 0)); return `<span class="star-rating" aria-label="${n} de 5">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`; }
  function ratingFor(item) { return ratings?.[item.canonicalId]?.rating || 0; }
  function configuredPageSize() { return clamp(Number(settings.views?.backlog?.itemsPerPage), 1, 60, 12); }

  function sessionKey() { return 'kiosko:v5.4.2:backlog'; }
  function saveSession() {
    try { sessionStorage.setItem(sessionKey(), JSON.stringify({ activeTypes: [...activeTypes], search, page, cardSize })); } catch {}
  }
  function loadSession() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(sessionKey()) || sessionStorage.getItem('kiosko:v5.4:backlog') || 'null');
      if (!parsed) return;
      if (Array.isArray(parsed.activeTypes)) activeTypes = new Set(parsed.activeTypes.filter(type => ['movies','games','series'].includes(type)));
      if (typeof parsed.search === 'string') search = parsed.search;
      if (Number.isFinite(Number(parsed.page))) page = Math.max(0, Number(parsed.page));
      if (['small','medium','large'].includes(parsed.cardSize)) cardSize = parsed.cardSize;
    } catch {}
  }

  function rawItems() { return [ ...(backlog.plex || []), ...(backlog.playnite || []) ]; }
  function countsByType() {
    return rawItems().reduce((acc, item) => { const type = typeFor(item); acc[type] = (acc[type] || 0) + 1; return acc; }, { movies: 0, games: 0, series: 0 });
  }
  function allItems() {
    const q = search.trim().toLowerCase();
    return rawItems()
      .filter(item => activeTypes.has(typeFor(item)))
      .filter(item => !q || `${item.title || ''} ${item.subtitle || ''} ${sourceLabel(item.source)} ${labelForItem(item)}`.toLowerCase().includes(q))
      .sort((a, b) => Date.parse(b.lastActivityAt || b.updatedAt || b.createdAt || 0) - Date.parse(a.lastActivityAt || a.updatedAt || a.createdAt || 0));
  }

  function pageItems() {
    const items = allItems();
    const pageSize = configuredPageSize();
    const pages = Math.max(1, Math.ceil(items.length / pageSize));
    page = Math.max(0, Math.min(page, pages - 1));
    return { items: items.slice(page * pageSize, page * pageSize + pageSize), total: items.length, pageSize, pages };
  }

  function setBackground(items) {
    const bg = el?.querySelector('[data-dynamic-bg]');
    if (!bg) return;
    const candidates = items.filter(item => item.backdrop || item.poster);
    if (!candidates.length) { bg.innerHTML = ''; return; }
    bgIndex = bgIndex % candidates.length;
    const src = candidates[bgIndex].backdrop || candidates[bgIndex].poster;
    bg.innerHTML = `<img src="${escapeAttr(src)}" alt="">`;
  }

  function restartBackgroundRotation() {
    clearInterval(bgTimer);
    const items = allItems().filter(item => item.backdrop || item.poster);
    bgIndex = Math.min(bgIndex, Math.max(0, items.length - 1));
    setBackground(items);
    if (items.length > 1 && isVisible) {
      bgTimer = setInterval(() => { bgIndex = (bgIndex + 1) % items.length; setBackground(items); }, 12000);
    }
  }

  function renderControls({ force = false } = {}) {
    if (!controlsRoot || !isVisible) return;
    if (!force && controlsMounted) return;
    controlsMounted = true;
    controlsRoot.innerHTML = `<button type="button" class="view-actions-button view-filter-button" data-backlog-open-controls aria-label="Filtros y vista"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v2H4V6Zm3 5h10v2H7v-2Zm3 5h4v2h-4v-2Z"/></svg><span class="view-filter-button__label">Filtros</span><span class="view-filter-button__meta" data-backlog-filter-meta></span></button>`;
    updateControlsState();
  }

  function updateControlsState() {
    if (!controlsRoot || !isVisible) return;
    const meta = controlsRoot.querySelector('[data-backlog-filter-meta]');
    if (meta) meta.textContent = `${activeTypes.size}/3 · ${currentSize().slice(0,1).toUpperCase()}`;
  }

  async function openControlsModal() {
    const counts = countsByType();
    const body = `<div class="controls-modal">
      <section class="controls-modal__section"><h3>Tipos</h3><div class="controls-modal__checks">
        ${['movies','games','series'].map(type => `<label class="controls-modal__toggle"><input type="checkbox" data-filter-type="${type}" ${activeTypes.has(type) ? 'checked' : ''}><span>${typeLabels[type]}</span><small>${counts[type] || 0}</small></label>`).join('')}
      </div></section>
      <section class="controls-modal__section"><h3>Tamaño de carátula</h3><div class="controls-modal__sizes">
        ${[['small','S'],['medium','M'],['large','L']].map(([value,label]) => `<label class="controls-modal__toggle"><input type="radio" name="backlog-size" value="${value}" ${currentSize() === value ? 'checked' : ''}><span>${label}</span></label>`).join('')}
      </div></section>
      <section class="controls-modal__section"><h3>Búsqueda</h3><label class="ui-field"><span>Filtrar por título o detalle</span><input type="search" data-control-search value="${escapeAttr(search)}" placeholder="Buscar" autocomplete="off"></label></section>
    </div>`;
    const result = await ui.open({
      title: 'Vista del Backlog',
      body,
      actions: [
        { label: 'Cancelar', value: null },
        { label: 'Aplicar', variant: 'primary', onClick: root => ({
          activeTypes: [...root.querySelectorAll('[data-filter-type]:checked')].map(input => input.dataset.filterType),
          cardSize: root.querySelector('input[name="backlog-size"]:checked')?.value || currentSize(),
          search: root.querySelector('[data-control-search]')?.value || ''
        }) }
      ]
    });
    if (!result) return;
    activeTypes = new Set(result.activeTypes.filter(type => ['movies','games','series'].includes(type)));
    if (activeTypes.size < 1) activeTypes = new Set(['movies','games','series']);
    cardSize = ['small','medium','large'].includes(result.cardSize) ? result.cardSize : 'medium';
    search = result.search || '';
    page = 0;
    bgIndex = 0;
    await api('/api/settings', { method: 'PUT', body: JSON.stringify({ views: { backlog: { cardSize } } }) }).catch(() => {});
    updateControlsState();
    render();
  }

  function render() {
    if (!el || !isVisible) return;
    const { items, total, pages } = pageItems();
    el.querySelector('[data-section-count]').textContent = `${total}`;
    const pager = el.querySelector('.pager');
    pager.hidden = pages <= 1;
    el.querySelector('[data-page-label]').textContent = `${page + 1}/${pages}`;
    el.querySelector('[data-prev]').disabled = page <= 0;
    el.querySelector('[data-next]').disabled = page >= pages - 1;
    updateControlsState();
    const grid = el.querySelector('.media-grid');
    const cfg = sizeMap[currentSize()];
    grid.style.setProperty('--card-width', `${cfg.width}px`);
    grid.style.setProperty('--card-gap', `${cfg.gap}px`);
    if (!items.length) {
      grid.innerHTML = `<div class="grid-empty">No hay elementos con estos filtros.</div>`;
      restartBackgroundRotation();
      saveSession();
      return;
    }
    grid.innerHTML = items.map(item => `<article class="media-card" data-id="${escapeAttr(item.id)}" data-source="${escapeAttr(item.source)}">
      <div class="media-card__poster">${item.poster ? `<img src="${escapeAttr(item.poster)}" alt="">` : `<div class="media-card__fallback">${escapeHtml((item.title || '?').slice(0, 1))}</div>`}</div>
      <div class="media-card__meta">
        <strong>${escapeHtml(item.title || 'Sin título')}</strong>
        <span>${escapeHtml(item.subtitle || labelForItem(item))}</span>
        ${ratingFor(item) ? stars(ratingFor(item)) : ''}
      </div>
    </article>`).join('');
    restartBackgroundRotation();
    saveSession();
  }

  function findItem(source, id) { return rawItems().find(item => item.source === source && item.id === id); }

  async function askRating(item) {
    return ui.open({
      title: item.source === 'plex' ? 'Marcar como visto' : 'Marcar como terminado',
      className: 'ui-modal-root--rating',
      body: `<div class="rating-modal">
        <div class="rating-modal__poster">${item.poster ? `<img src="${escapeAttr(item.poster)}" alt="">` : ''}</div>
        <div class="rating-modal__copy"><h3>${escapeHtml(item.title || 'Sin título')}</h3><p>${escapeHtml(item.subtitle || sourceLabel(item.source))}</p>
        <fieldset class="rating-picker">
          ${[1,2,3,4,5].map(n => `<button type="button" data-rating="${n}" aria-label="${n} estrellas">☆</button>`).join('')}
        </fieldset></div>
      </div>`,
      actions: [
        { label: 'Cancelar', value: null },
        { label: 'Confirmar', variant: 'primary', onClick: (root) => Number(root.querySelector('.rating-picker')?.dataset.value || 0) }
      ]
    });
  }

  async function openItem(item) {
    return ui.actionSheet({
      title: item.title || 'Item',
      actions: [
        { id: 'complete', label: actionLabel(item), description: 'Valorar, mover a Colecciones y retirar del Backlog', run: async () => {
          const rating = await askRating(item);
          if (rating === null) return;
          await api(`/api/backlog/${item.source}/${item.id}/complete`, { method: 'POST', body: JSON.stringify({ rating }) });
          ui.toast(item.source === 'plex' ? 'Marcado como visto' : 'Marcado como terminado');
        }},
        { id: 'delete', label: 'Eliminar del backlog', description: 'Quitar de este listado', run: async () => {
          const ok = await ui.confirm({ title: 'Eliminar del backlog', message: '¿Quitar este elemento del backlog?', confirmText: 'Eliminar', danger: true });
          if (!ok) return;
          await api(`/api/backlog/${item.source}/${item.id}`, { method: 'DELETE' });
          ui.toast('Elemento eliminado');
        }}
      ]
    });
  }

  return {
    id: 'backlog',
    mount(target) {
      el = target;
      loadSession();
      el.innerHTML = `<div class="app-section backlog-view">
        <div class="section-bg" data-dynamic-bg></div>
        <header class="section-title"><h1>Backlog <span data-section-count>0</span></h1></header>
        <section class="media-grid" aria-label="Backlog"></section>
        <footer class="pager"><button data-prev aria-label="Página anterior">‹</button><span data-page-label>1/1</span><button data-next aria-label="Página siguiente">›</button></footer>
      </div>`;
      el.addEventListener('click', async (event) => {
        if (event.target.closest('[data-prev]')) { page -= 1; render(); return; }
        if (event.target.closest('[data-next]')) { page += 1; render(); return; }
        const card = event.target.closest('.media-card');
        if (card) { const item = findItem(card.dataset.source, card.dataset.id); if (item) await openItem(item); }
      });
      controlsRoot?.addEventListener('click', event => {
        if (!isVisible) return;
        if (event.target.closest('[data-backlog-open-controls]')) openControlsModal();
      });
      window.addEventListener('resize', () => { if (isVisible) render(); });
      document.addEventListener('click', (event) => { const btn = event.target.closest('.rating-picker button'); if (!btn) return; const picker = btn.closest('.rating-picker'); picker.dataset.value = btn.dataset.rating; picker.querySelectorAll('button').forEach(node => { node.textContent = Number(node.dataset.rating) <= Number(btn.dataset.rating) ? '★' : '☆'; }); });
    },
    show() { isVisible = true; controlsMounted = false; el.classList.add('view--active'); el.setAttribute('aria-hidden', 'false'); renderControls({ force: true }); render(); },
    hide() { isVisible = false; clearInterval(bgTimer); controlsMounted = false; el.classList.remove('view--active'); el.setAttribute('aria-hidden', 'true'); if (controlsRoot) controlsRoot.innerHTML = ''; },
    update(data = {}) { if (data.backlog) backlog = data.backlog; if (data.completionRatings) ratings = data.completionRatings; if (data.settings) { settings = data.settings; cardSize = settings.views?.backlog?.cardSize || cardSize; } if (isVisible) render(); }
  };
}
function clamp(value, min, max, fallback) { const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'\"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
