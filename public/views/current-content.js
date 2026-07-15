function text(value) {
  return Array.isArray(value) ? value.filter(Boolean).join(' · ') : (value ? String(value) : '');
}
function setText(el, value) {
  const formatted = text(value);
  el.textContent = formatted || '';
  el.hidden = !formatted;
}
function normalizeContent(input = {}) {
  if (!input) return null;
  const source = input.source || (input.kind === 'game' ? 'playnite' : input.kind === 'plex' ? 'plex' : input.platforms ? 'playnite' : 'plex');
  const isGame = source === 'playnite' || input.kind === 'game' || input.platforms;
  if (isGame) {
    return {
      ...input,
      kind: 'game',
      source: 'playnite',
      label: 'JUGANDO AHORA',
      title: input.title || 'Juego sin título',
      subtitle: text(input.platforms),
      poster: input.cover || input.poster || input.posterUrl || input.coverPath || null,
      backdrop: input.background || input.backdrop || input.backdropUrl || input.backdropPath || null,
      lines: [
        ['Desarrollador', text(input.developers)],
        ['Distribuidor', text(input.publishers)],
        ['Lanzamiento', input.releaseYear],
        ['Géneros', text(input.genres)]
      ].filter(([, v]) => Boolean(v))
    };
  }
  return {
    ...input,
    kind: 'plex',
    source: 'plex',
    label: ({ play: 'REPRODUCIENDO', pause: 'PAUSADO', stop: 'DETENIDO', recently_added: 'AÑADIDO' }[input.event] || 'PLEX'),
    title: input.title || 'Sin reproducción',
    subtitle: input.subtitle || '',
    poster: input.posterUrl || input.poster || input.cover || null,
    backdrop: input.backdropUrl || input.backdrop || input.background || null,
    lines: [
      ['Año', input.year],
      ['Tipo', input.type]
    ].filter(([, v]) => Boolean(v))
  };
}

export function createCurrentContentView({ api, ui, controlsRoot } = {}) {
  let el;
  let current = null;
  let isVisible = false;

  async function clearCurrent() {
    await api('/api/current/clear', { method: 'POST' });
    current = null;
    render(null);
    ui.toast('Contenido actual limpiado');
  }
  function openActions() {
    ui.actionSheet({
      title: current?.title || 'Contenido actual',
      actions: [
        { id: 'clear', label: 'Limpiar contenido actual', description: 'Dejar la vista Actual vacía', run: clearCurrent }
      ]
    });
  }
  function renderControls() {
    if (!controlsRoot || !isVisible) return;
    controlsRoot.innerHTML = `<button class="topbar-button view-actions-button" type="button" data-current-actions aria-label="Acciones de contenido actual">•••</button>`;
  }
  function render(data) {
    const media = normalizeContent(data);
    current = media;
    const root = el.querySelector('.media-view');
    const empty = el.querySelector('.current-empty');
    root.classList.toggle('media-view--empty', !media);
    empty.hidden = Boolean(media);
    if (!media) {
      el.querySelector('.media-title').textContent = '';
      el.querySelector('.media-poster').removeAttribute('src');
      el.querySelector('.media-bg-img').removeAttribute('src');
      return;
    }
    root.dataset.source = media.source || 'current';
    el.querySelector('.media-event').textContent = media.label || 'ACTUAL';
    el.querySelector('.media-title').textContent = media.title || 'Sin título';
    setText(el.querySelector('.media-subtitle'), media.subtitle);
    const meta = el.querySelector('.media-meta-lines');
    meta.innerHTML = (media.lines || []).slice(0, 5).map(([label, value]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`).join('');
    const poster = el.querySelector('.media-poster');
    poster.src = media.poster || '';
    poster.style.visibility = media.poster ? 'visible' : 'hidden';
    const bg = el.querySelector('.media-bg-img');
    bg.src = media.backdrop || media.poster || '';
    bg.classList.toggle('media-bg-img--visible', Boolean(media.backdrop || media.poster));
  }

  return {
    id: 'current-content',
    mount(target) {
      el = target;
      el.innerHTML = `<div class="media-view media-view--current">
        <img class="media-bg-img" alt="">
        <div class="media-bg-treatment"></div>
        <div class="media-overlay"></div>
        <div class="current-empty" hidden>
          <h1>Actual <span>0</span></h1>
          <p>No hay nada en reproducción. Cuando empieces a ver algo en Plex o lances un juego desde Playnite aparecerá aquí.</p>
        </div>
        <div class="media-layout">
          <div class="item-visual item-visual--plain"><img class="media-poster" alt="Carátula"></div>
          <div class="media-info"><span class="media-event"></span><h1 class="media-title"></h1><p class="media-subtitle"></p><div class="media-meta-lines"></div></div>
        </div>
      </div>`;
      controlsRoot?.addEventListener('click', event => { if (isVisible && event.target.closest('[data-current-actions]')) openActions(); });
      render(null);
    },
    show() { isVisible = true; el.classList.add('view--active'); el.setAttribute('aria-hidden', 'false'); renderControls(); },
    hide() { isVisible = false; el.classList.remove('view--active'); el.setAttribute('aria-hidden', 'true'); if (controlsRoot) controlsRoot.innerHTML = ''; },
    update(data) { render(data); }
  };
}
function escapeHtml(value) { return String(value ?? '').replace(/[&<>\'\"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }
