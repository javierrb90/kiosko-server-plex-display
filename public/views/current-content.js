function escapeHtml(value) { return String(value ?? '').replace(/[&<>'\"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
function text(value) { return Array.isArray(value) ? value.filter(Boolean).join(' · ') : (value ? String(value) : ''); }
function setText(el, value) { const formatted = text(value); el.textContent = formatted || ''; el.hidden = !formatted; }
function slug(value) { return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item'; }
function canonicalFor(media = {}) {
  if (media.canonicalId) return media.canonicalId;
  if (media.source === 'playnite' || media.kind === 'game') return `playnite:${slug(media.gameId || media.title)}`;
  return `plex:${media.collectionType || media.type || 'item'}:${media.ratingKey || slug(media.title)}`;
}
function stars(value = 0) { const n = Math.max(0, Math.min(5, Number(value) || 0)); return `<span class="star-rating" aria-label="${n} de 5">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`; }
function normalizeContent(input = {}) {
  if (!input) return null;
  const source = input.source || (input.kind === 'game' ? 'playnite' : input.kind === 'plex' ? 'plex' : input.platforms ? 'playnite' : 'plex');
  const isGame = source === 'playnite' || input.kind === 'game' || input.platforms;
  if (isGame) return { ...input, kind: 'game', source: 'playnite', collectionType: 'games', label: '', title: input.title || 'Juego sin título', subtitle: text(input.platforms), poster: input.cover || input.poster || input.posterUrl || input.coverPath || null, backdrop: input.background || input.backdrop || input.backdropUrl || input.backdropPath || null, lines: [['Desarrollador', text(input.developers)], ['Distribuidor', text(input.publishers)], ['Lanzamiento', input.releaseYear], ['Géneros', text(input.genres)]].filter(([, v]) => Boolean(v)) };
  return { ...input, kind: 'plex', source: 'plex', collectionType: input.collectionType || (input.type === 'movie' ? 'movies' : 'series'), label: '', title: input.title || 'Sin reproducción', subtitle: input.subtitle || '', poster: input.posterUrl || input.poster || input.cover || null, backdrop: input.backdropUrl || input.backdrop || input.background || null, lines: [['Año', input.year], ['Tipo', input.type]].filter(([, v]) => Boolean(v)) };
}

export function createCurrentContentView({ api, ui, controlsRoot } = {}) {
  let el; let current = null; let isVisible = false; let onDeckMap = {}; let backlogMap = {}; let ratings = {}; let settings = {};
  function statusMarkup(media) {
    if (!media) return '';
    const key = canonicalFor(media);
    const completion = ratings?.[key];
    if (onDeckMap?.[key]) return `<span class="deck-pill">On Deck</span>`;
    if (completion?.rating) return `<span class="current-status-rated">${stars(completion.rating)}<button type="button" data-current-remove-rating aria-label="Eliminar de Colección">×</button></span>`;
    if (backlogMap?.[key]) return `<span class="deck-pill deck-pill--backlog">Backlog</span>`;
    return `<span class="deck-pill deck-pill--neutral">Sin clasificar</span>`;
  }
  function visualMarkup(media) {
    const image = media?.poster || media?.cover || media?.posterUrl || media?.backdrop || media?.background || '';
    const initial = escapeHtml((media?.title || '?').slice(0, 1));
    return image ? `<img class="media-poster" src="${escapeAttr(image)}" alt="Carátula">` : `<div class="media-poster media-poster--fallback"><span>${initial}</span></div>`;
  }
  function ratingInlineMarkup(media) {
    if (!media) return '';
    const currentRating = ratings?.[canonicalFor(media)]?.rating || 0;
    const label = media.source === 'plex' ? 'Marcar como visto' : 'Marcar como terminado';
    return `<div class="current-rating-inline" aria-label="${escapeAttr(label)}">
      <span>Puntuar</span>
      <div class="current-rating-stars">${[1,2,3,4,5].map(n => `<button type="button" data-current-rate="${n}" aria-label="${n} estrellas">${n <= currentRating ? '★' : '☆'}</button>`).join('')}</div><small>Al puntuar pasa a Colección</small>
    </div>`;
  }
  async function clearCurrent() { await api('/api/current/clear', { method: 'POST' }); current = null; render(null); ui.toast('Contenido actual limpiado'); }
  async function addToDeck() { await api('/api/current/deck', { method: 'POST' }); ui.toast('Añadido a On Deck'); }
  async function askRating(item) { return ui.open({ title: item.source === 'plex' ? 'Marcar como visto' : 'Marcar como terminado', className: 'ui-modal-root--rating', body: `<div class="rating-modal"><div class="rating-modal__poster">${item.poster ? `<img src="${escapeAttr(item.poster)}" alt="">` : ''}</div><div class="rating-modal__copy"><h3>${escapeHtml(item.title || 'Sin título')}</h3><p>${escapeHtml(item.subtitle || '')}</p><fieldset class="rating-picker">${[1,2,3,4,5].map(n => `<button type="button" data-rating="${n}">☆</button>`).join('')}</fieldset></div></div>`, actions: [{ label: 'Cancelar', value: null }, { label: 'Confirmar', variant: 'primary', onClick: root => Number(root.querySelector('.rating-picker')?.dataset.value || 0) }] }); }
  async function completeCurrent() { if (!current) return; const rating = await askRating(current); if (rating === null) return; await completeWithRating(rating); }
  async function completeWithRating(rating) { if (!current) return; await api('/api/current/complete', { method: 'POST', body: JSON.stringify({ rating }) }); ui.toast(current.source === 'plex' ? 'Marcado como visto' : 'Marcado como terminado'); }
  async function removeCurrentRating() {
    if (!current) return;
    const completion = ratings?.[canonicalFor(current)];
    if (!completion?.id) return;
    await api(`/api/completions/${encodeURIComponent(completion.id)}`, { method: 'DELETE' });
    ui.toast('Eliminado de Colección');
  }
  function openActions() { if (!current) return; ui.actionSheet({ title: current?.title || 'Contenido actual', actions: [ { id: 'clear', label: 'Limpiar contenido actual', description: 'Dejar la vista Actual vacía', run: clearCurrent } ] }); }
  function renderPrimaryActions(media) {
    const actions = el?.querySelector('[data-current-primary-actions]');
    if (!actions) return;
    if (!media) { actions.innerHTML = ''; actions.hidden = true; return; }
    const inDeck = Boolean(onDeckMap?.[canonicalFor(media)]);
    actions.hidden = false;
    actions.innerHTML = `
      ${ratingInlineMarkup(media)}
      <button class="current-action" type="button" data-current-deck ${inDeck ? 'disabled' : ''}>${inDeck ? 'Ya está en On Deck' : 'Añadir a On Deck'}</button>
    `;
  }
  function renderControls() { if (!controlsRoot || !isVisible) return; controlsRoot.innerHTML = `<button class="topbar-button view-actions-button" type="button" data-current-actions aria-label="Más acciones">•••</button>`; }
  function render(data = current) {
    const media = normalizeContent(data); current = media; if (!el) return; const root = el.querySelector('.media-view'); const empty = el.querySelector('.current-empty'); root.classList.toggle('media-view--empty', !media); empty.hidden = Boolean(media);
    if (!media) { el.querySelector('.media-title').textContent = ''; const visual = el.querySelector('.current-visual'); if (visual) visual.innerHTML = ''; el.querySelector('.media-bg-img').removeAttribute('src'); renderPrimaryActions(null); return; }
    root.dataset.source = media.source || 'current'; el.querySelector('.media-event').textContent = ''; el.querySelector('.media-event').hidden = true; el.querySelector('.media-title').textContent = media.title || 'Sin título'; setText(el.querySelector('.media-subtitle'), media.subtitle); el.querySelector('.current-status').innerHTML = statusMarkup(media); renderPrimaryActions(media);
    const meta = el.querySelector('.media-meta-lines'); meta.innerHTML = (media.lines || []).slice(0, 5).map(([label, value]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`).join(''); const visual = el.querySelector('.current-visual'); if (visual) visual.innerHTML = visualMarkup(media); const bg = el.querySelector('.media-bg-img'); bg.src = media.backdrop || media.poster || media.background || ''; bg.classList.toggle('media-bg-img--visible', Boolean(media.backdrop || media.poster || media.background));
  }
  return { id: 'current-content', mount(target) { el = target; el.innerHTML = `<div class="media-view media-view--current"><img class="media-bg-img" alt=""><div class="media-bg-treatment"></div><div class="media-overlay"></div><div class="current-empty" hidden><h1>Actual <span>0</span></h1><p>No hay nada en reproducción. Cuando empieces a ver algo en Plex o lances un juego desde Playnite aparecerá aquí.</p></div><div class="media-layout media-layout--current-card"><article class="current-content-card"><div class="current-visual item-visual item-visual--plain"></div><div class="media-info current-card-info"><span class="media-event"></span><h1 class="media-title"></h1><p class="media-subtitle"></p><div class="current-status"></div><div class="current-primary-actions" data-current-primary-actions hidden></div><div class="media-meta-lines"></div></div></article></div></div>`; controlsRoot?.addEventListener('click', event => { if (isVisible && event.target.closest('[data-current-actions]')) openActions(); });
    el.addEventListener('click', event => {
      if (!isVisible) return;
      const removeRating = event.target.closest('[data-current-remove-rating]');
      if (removeRating) removeCurrentRating();
      const rate = event.target.closest('[data-current-rate]');
      if (rate) completeWithRating(Number(rate.dataset.currentRate || 0));
      if (event.target.closest('[data-current-deck]')) addToDeck();
    }); document.addEventListener('click', event => { const btn = event.target.closest('.rating-picker button'); if (!btn) return; const picker = btn.closest('.rating-picker'); picker.dataset.value = btn.dataset.rating; picker.querySelectorAll('button').forEach(node => { node.textContent = Number(node.dataset.rating) <= Number(btn.dataset.rating) ? '★' : '☆'; }); }); render(null); }, show() { isVisible = true; el.classList.add('view--active'); el.setAttribute('aria-hidden', 'false'); renderControls(); render(); }, hide() { isVisible = false; el.classList.remove('view--active'); el.setAttribute('aria-hidden', 'true'); if (controlsRoot) controlsRoot.innerHTML = ''; }, update(data = {}) { if (data?.currentContent !== undefined) render(data.currentContent); else if (data && (data.title || data.kind || data.event)) render(data); if (data?.onDeckMap) onDeckMap = data.onDeckMap; if (data?.backlogMap) backlogMap = data.backlogMap; if (data?.completionRatings) ratings = data.completionRatings; if (data?.settings) settings = data.settings; if (isVisible) render(); } };
}
