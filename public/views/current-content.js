function text(value) {
  return Array.isArray(value) ? value.filter(Boolean).join(' · ') : (value ? String(value) : '');
}
function first(value) {
  return Array.isArray(value) ? value.filter(Boolean)[0] : value;
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
async function resolveCollection({ api, ui }) {
  const collections = await api('/api/collections');
  const choice = await ui.chooseCollection(collections);
  if (!choice) return null;
  if (choice.newName) return api('/api/collections', { method: 'POST', body: JSON.stringify({ name: choice.newName }) });
  return collections.find(c => c.id === choice.selectedId) || null;
}

export function createCurrentContentView({ api, ui } = {}) {
  let el;
  let current = null;

  async function addBackdropAsWallpaper() {
    const backdrop = current?.backdrop;
    if (!backdrop) return ui.alert('No hay fondo disponible.');
    await api('/api/wallpapers', {
      method: 'POST',
      body: JSON.stringify({
        title: current.title || 'Fondo actual',
        source: current.source || 'current',
        image: backdrop,
        meta: { kind: current.kind, source: current.source, title: current.title }
      })
    });
    ui.toast('Fondo añadido a wallpapers');
  }
  async function addCoverToCollection() {
    const cover = current?.poster;
    if (!cover) return ui.alert('No hay carátula disponible.');
    const collection = await resolveCollection({ api, ui });
    if (!collection) return;
    await api(`/api/collections/${collection.id}/items`, {
      method: 'POST',
      body: JSON.stringify({
        title: current.title || 'Item actual',
        source: current.source || 'current',
        coverImage: cover,
        backdropImage: current.backdrop,
        meta: {
          kind: current.kind,
          source: current.source,
          subtitle: current.subtitle,
          year: current.year || current.releaseYear || null,
          platforms: current.platforms || null,
          developers: current.developers || null,
          publishers: current.publishers || null,
          genres: current.genres || null,
          ratingKey: current.ratingKey || null,
          plexType: current.type || null,
          displaySkin: current.displaySkin || 'none'
        }
      })
    });
    ui.toast('Añadido a colección', { detail: collection.name });
  }
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
        { id: 'wallpaper', label: 'Añadir fondo a wallpapers', description: current?.backdrop ? 'Guardar este fondo para el Dashboard' : 'No hay fondo disponible', disabled: !current?.backdrop, run: addBackdropAsWallpaper },
        { id: 'collection', label: 'Añadir portada a colección', description: current?.poster ? 'Guardar portada y fondo en una colección' : 'No hay portada disponible', disabled: !current?.poster, run: addCoverToCollection },
        { id: 'clear', label: 'Limpiar contenido actual', description: 'Dejar la vista Actual vacía', run: clearCurrent }
      ]
    });
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
    applyAccentFromImage(root, media.poster || media.backdrop);
  }

  return {
    id: 'current-content',
    mount(target) {
      el = target;
      el.innerHTML = `<div class="media-view media-view--current">
        <img class="media-bg-img" alt="">
        <div class="media-bg-treatment"></div>
        <div class="media-overlay"></div>
        <button class="media-menu-button kiosk-control" type="button" data-actions aria-label="Acciones">...</button>
        <div class="current-empty" hidden>
          <p class="eyebrow">Contenido actual</p>
          <h1>Nada en reproducción</h1>
          <p>Cuando empieces a ver algo en Plex o lances un juego desde Playnite aparecerá aquí.</p>
        </div>
        <div class="media-layout">
          <div class="item-visual item-visual--plain">
            <img class="media-poster" alt="Carátula">
          </div>
          <div class="media-info">
            <span class="media-event"></span>
            <h1 class="media-title"></h1>
            <p class="media-subtitle"></p>
            <div class="media-meta-lines"></div>
          </div>
        </div>
      </div>`;
      el.querySelector('[data-actions]').addEventListener('click', (event) => { event.stopPropagation(); openActions(); });
      render(null);
    },
    show() { el.classList.add('view--active'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.remove('view--active'); el.setAttribute('aria-hidden', 'true'); },
    update(data) { render(data); }
  };
}

function applyAccentFromImage(container, src) {
  if (!container || !src || !String(src).startsWith('/assets/')) return;
  const img = new Image();
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      const size = 24;
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 16) {
        if (data[i + 3] < 160) continue;
        r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
      }
      if (!count) return;
      container.style.setProperty('--accent-color', `rgb(${Math.round(r/count)}, ${Math.round(g/count)}, ${Math.round(b/count)})`);
    } catch {}
  };
  img.src = src;
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}
