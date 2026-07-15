export function createOnDeckView({ api, ui, controlsRoot } = {}) {
  let el;
  let items = [];
  let ratings = {};
  let settings = {};
  let activeTypes = new Set(['movies', 'games', 'series']);
  let cardSize = 'medium';
  let search = '';
  let page = 0;
  let isVisible = false;
  let bgTimer = null;
  let bgCurrentSrc = '';
  let controlsMounted = false;
  const sizeMap = { small: { width: 220, gap: 12, poster: 74, mobileColumns: 2 }, medium: { width: 290, gap: 16, poster: 92, mobileColumns: 3 }, large: { width: 360, gap: 18, poster: 110, mobileColumns: 4 } };
  const typeLabels = { movies: 'Películas', games: 'Juegos', series: 'Series' };
  function currentSize() { return ['small','medium','large'].includes(cardSize) ? cardSize : 'medium'; }
  function typeFor(item) { return ['movies','games','series'].includes(item.collectionType) ? item.collectionType : (item.source === 'playnite' ? 'games' : 'series'); }
  function label(item) { return typeLabels[typeFor(item)] || 'Item'; }
  function stars(value = 0) { const n = Math.max(0, Math.min(5, Number(value) || 0)); return `<span class="star-rating" aria-label="${n} de 5">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`; }
  function ratingFor(item) { return ratings?.[item.canonicalId]?.rating || 0; }
  function configuredPageSize() { return clamp(Number(settings.views?.onDeck?.itemsPerPage), 1, 120, 12); }
  function countsByType() { return items.reduce((acc, item) => { const type = typeFor(item); acc[type] = (acc[type] || 0) + 1; return acc; }, { movies: 0, games: 0, series: 0 }); }
  function filtered() { const q = search.trim().toLowerCase(); return items.filter(item => activeTypes.has(typeFor(item))).filter(item => !q || `${item.title || ''} ${item.subtitle || ''} ${label(item)}`.toLowerCase().includes(q)).sort((a,b) => Date.parse(b.addedToDeckAt || b.updatedAt || 0) - Date.parse(a.addedToDeckAt || a.updatedAt || 0)); }
  function visible() { const list = filtered(); const pageSize = configuredPageSize(); const pages = Math.max(1, Math.ceil(list.length / pageSize)); page = Math.max(0, Math.min(page, pages - 1)); return { rows: list.slice(page * pageSize, page * pageSize + pageSize), total: list.length, pages }; }

  function itemBackdrop(item = {}) {
    return item.backdrop || item.backdropUrl || item.background || item.meta?.showBackdrop || item.meta?.originalBackdropUrl || item.poster || item.posterUrl || item.cover || item.meta?.showPoster || item.meta?.originalPosterUrl || '';
  }
  function visibleBackdrops() {
    const list = filtered().map(itemBackdrop).filter(Boolean);
    return list;
  }
  function pickBackground(backdrops = []) {
    if (!backdrops.length) return '';
    if (backdrops.length === 1) return backdrops[0];
    const options = backdrops.filter(src => src !== bgCurrentSrc);
    return options[Math.floor(Math.random() * options.length)] || backdrops[Math.floor(Math.random() * backdrops.length)];
  }
  function setBackground(src = '') {
    const bg = el?.querySelector('[data-dynamic-bg]');
    if (!bg) return;
    if (!src) {
      bg.innerHTML = '';
      bg.dataset.src = '';
      bgCurrentSrc = '';
      return;
    }
    if (bg.dataset.src === src) return;
    bg.dataset.src = src;
    bgCurrentSrc = src;

    const img = document.createElement('img');
    img.className = 'section-bg__image';
    img.alt = '';
    img.src = src;
    img.style.backgroundImage = `url("${String(src).replace(/"/g, '\"')}")`;
    bg.appendChild(img);

    requestAnimationFrame(() => img.classList.add('is-visible'));

    const oldImages = [...bg.querySelectorAll('.section-bg__image')].filter(node => node !== img);
    window.setTimeout(() => oldImages.forEach(node => node.remove()), 1600);
  }
  function restartBackgroundRotation() {
    if (bgTimer) clearInterval(bgTimer);
    const apply = () => setBackground(pickBackground(visibleBackdrops()));
    apply();
    const seconds = clamp(Number(settings.design?.background?.rotationSeconds), 3, 120, 12);
    bgTimer = setInterval(apply, seconds * 1000);
  }

  function updateControlsState() { if (!controlsRoot || !isVisible) return; const meta = controlsRoot.querySelector('[data-deck-filter-meta]'); if (meta) meta.textContent = `${activeTypes.size}/3 · ${currentSize().slice(0,1).toUpperCase()}`; }
  function renderControls({ force = false } = {}) { if (!controlsRoot || !isVisible) return; if (!force && controlsMounted) return; controlsMounted = true; controlsRoot.innerHTML = `<button type="button" class="view-actions-button view-filter-button" data-deck-open-controls aria-label="Filtros y vista"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v2H4V6Zm3 5h10v2H7v-2Zm3 5h4v2h-4v-2Z"/></svg><span class="view-filter-button__label">Filtros</span><span class="view-filter-button__meta" data-deck-filter-meta></span></button>`; updateControlsState(); }
  async function openControlsModal() {
    const counts = countsByType();
    const body = `<div class="controls-modal"><section class="controls-modal__section"><h3>Tipos</h3><div class="controls-modal__checks">${['games','movies','series'].map(type => `<label class="controls-modal__toggle"><input type="checkbox" data-filter-type="${type}" ${activeTypes.has(type) ? 'checked' : ''}><span>${typeLabels[type]}</span><small>${counts[type] || 0}</small></label>`).join('')}</div></section><section class="controls-modal__section"><h3>Tamaño de carátula</h3><div class="controls-modal__sizes">${[['small','S'],['medium','M'],['large','L']].map(([value,label]) => `<label class="controls-modal__toggle"><input type="radio" name="deck-size" value="${value}" ${currentSize() === value ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div></section><section class="controls-modal__section"><h3>Búsqueda</h3><label class="ui-field"><span>Filtrar por título o detalle</span><input type="search" data-control-search value="${escapeAttr(search)}" placeholder="Buscar" autocomplete="off"></label></section></div>`;
    const result = await ui.open({ title: 'Vista On Deck', body, actions: [{ label: 'Cancelar', value: null }, { label: 'Aplicar', variant: 'primary', onClick: root => ({ activeTypes: [...root.querySelectorAll('[data-filter-type]:checked')].map(input => input.dataset.filterType), cardSize: root.querySelector('input[name="deck-size"]:checked')?.value || currentSize(), search: root.querySelector('[data-control-search]')?.value || '' }) }] });
    if (!result) return; activeTypes = new Set(result.activeTypes.filter(type => ['games','movies','series'].includes(type))); if (activeTypes.size < 1) activeTypes = new Set(['games','movies','series']); cardSize = ['small','medium','large'].includes(result.cardSize) ? result.cardSize : 'medium'; search = result.search || ''; page = 0; await api('/api/settings', { method: 'PUT', body: JSON.stringify({ views: { onDeck: { cardSize } } }) }).catch(() => {}); render();
  }
  function emptyMarkup() { return !items.length ? `<div class="grid-empty grid-empty--rich"><strong>On Deck está vacío</strong><p>Añade aquí contenido desde Backlog o Actual para tenerlo controlado.</p></div>` : `<div class="grid-empty grid-empty--rich"><strong>No hay resultados</strong><p>Prueba a cambiar los filtros.</p></div>`; }
  function render() {
    if (!el || !isVisible) return; const { rows, total, pages } = visible(); el.querySelector('[data-section-count]').textContent = `${total}`; const pager = el.querySelector('.pager'); pager.hidden = pages <= 1; el.querySelector('[data-page-label]').textContent = `${page + 1}/${pages}`; el.querySelector('[data-prev]').disabled = page <= 0; el.querySelector('[data-next]').disabled = page >= pages - 1; updateControlsState(); const grid = el.querySelector('.media-grid'); const cfg = sizeMap[currentSize()]; grid.style.setProperty('--card-width', `${cfg.width}px`); grid.style.setProperty('--card-gap', `${cfg.gap}px`); grid.style.setProperty('--card-poster-size', `${cfg.poster}px`); grid.style.setProperty('--mobile-columns', String(cfg.mobileColumns)); if (!rows.length) { grid.innerHTML = emptyMarkup(); restartBackgroundRotation(); return; }
    grid.innerHTML = rows.map(item => { const bg = item.backdrop || item.poster || ''; const rating = ratingFor(item); return `<article class="media-card media-card--rich" data-id="${escapeAttr(item.id)}" data-source="${escapeAttr(item.source)}">${bg ? `<div class="media-card__bg" style="background-image:url('${escapeAttr(bg)}')"></div>` : ''}<div class="media-card__surface"><div class="media-card__poster">${item.poster ? `<img src="${escapeAttr(item.poster)}" alt="">` : `<div class="media-card__fallback">${escapeHtml((item.title || '?').slice(0,1))}</div>`}</div><div class="media-card__meta"><strong>${escapeHtml(item.title || 'Sin título')}</strong><span>${escapeHtml(item.subtitle || label(item))}</span>${rating ? `<div class="media-card__completion">${stars(rating)}</div>` : ''}</div></div></article>`; }).join('');
    restartBackgroundRotation();
  }
  function find(id) { return items.find(item => item.id === id); }
  async function askRating(item) { return ui.open({ title: item.source === 'plex' ? 'Marcar como visto' : 'Marcar como terminado', className: 'ui-modal-root--rating', body: `<div class="rating-modal"><div class="rating-modal__poster">${item.poster ? `<img src="${escapeAttr(item.poster)}" alt="">` : ''}</div><div class="rating-modal__copy"><h3>${escapeHtml(item.title || 'Sin título')}</h3><p>${escapeHtml(item.subtitle || label(item))}</p><fieldset class="rating-picker">${[1,2,3,4,5].map(n => `<button type="button" data-rating="${n}">☆</button>`).join('')}</fieldset></div></div>`, actions: [{ label: 'Cancelar', value: null }, { label: 'Confirmar', variant: 'primary', onClick: root => Number(root.querySelector('.rating-picker')?.dataset.value || 0) }] }); }
  async function openItem(item) { return ui.actionSheet({ title: item.title || 'On Deck', actions: [
    { id: 'complete', variant: 'primary', label: item.source === 'plex' ? 'Marcar como visto' : 'Marcar como terminado', description: 'Mover a Colecciones y sacar de On Deck', run: async () => { const rating = await askRating(item); if (rating === null) return; await api(`/api/on-deck/${item.id}/complete`, { method: 'POST', body: JSON.stringify({ rating }) }); ui.toast('Movido a Colecciones'); } },
    { id: 'backlog', label: 'Devolver al Backlog', description: 'Sacarlo de On Deck y devolverlo a pendientes', run: async () => { await api(`/api/on-deck/${item.id}/backlog`, { method: 'POST' }); ui.toast('Devuelto al Backlog'); } },
    { id: 'delete', label: 'Quitar de On Deck', description: 'No lo marca como terminado', run: async () => { const ok = await ui.confirm({ title: 'Quitar de On Deck', message: '¿Quitar este elemento de On Deck?', confirmText: 'Quitar' }); if (!ok) return; await api(`/api/on-deck/${item.id}`, { method: 'DELETE' }); ui.toast('Quitado de On Deck'); } }
  ]}); }
  return { id: 'on-deck', mount(target) { el = target; el.innerHTML = `<div class="app-section deck-view"><div class="section-bg" data-dynamic-bg></div><header class="section-title"><h1>On Deck <span data-section-count>0</span></h1></header><section class="media-grid" aria-label="On Deck"></section><footer class="pager"><button data-prev aria-label="Página anterior">‹</button><span data-page-label>1/1</span><button data-next aria-label="Página siguiente">›</button></footer></div>`; el.addEventListener('click', async event => { if (event.target.closest('[data-prev]')) { page -= 1; render(); return; } if (event.target.closest('[data-next]')) { page += 1; render(); return; } const card = event.target.closest('.media-card'); if (card) { const item = find(card.dataset.id); if (item) await openItem(item); } }); controlsRoot?.addEventListener('click', event => { if (isVisible && event.target.closest('[data-deck-open-controls]')) openControlsModal(); }); document.addEventListener('click', event => { const btn = event.target.closest('.rating-picker button'); if (!btn) return; const picker = btn.closest('.rating-picker'); picker.dataset.value = btn.dataset.rating; picker.querySelectorAll('button').forEach(node => { node.textContent = Number(node.dataset.rating) <= Number(btn.dataset.rating) ? '★' : '☆'; }); }); }, show() { isVisible = true; controlsMounted = false; el.classList.add('view--active'); el.setAttribute('aria-hidden', 'false'); renderControls({ force: true }); render(); }, hide() { isVisible = false; controlsMounted = false; if (bgTimer) clearInterval(bgTimer); el.classList.remove('view--active'); el.setAttribute('aria-hidden', 'true'); if (controlsRoot) controlsRoot.innerHTML = ''; }, update(data = {}) { if (Array.isArray(data.onDeck)) items = data.onDeck; if (data.completionRatings) ratings = data.completionRatings; if (data.settings) { settings = data.settings; cardSize = settings.views?.onDeck?.cardSize || cardSize; } if (isVisible) { render(); restartBackgroundRotation(); } } };
}
function clamp(value, min, max, fallback) { const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>\'\"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
