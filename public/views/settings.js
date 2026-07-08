export function createSettingsView({ api, ui } = {}) {
  let el;
  let settings = {};
  let wallpapers = [];
  let collections = [];
  let isVisible = false;

  function value(path, fallback = '') {
    return path.split('.').reduce((acc, key) => acc && acc[key], settings) ?? fallback;
  }

  function render() {
    if (!el || !isVisible) return;
    const plexUrl = value('plex.url', 'No configurado');
    const dimEnabled = value('display.dimEnabled', true) ? 'Activada' : 'Desactivada';
    const dimSeconds = value('display.dimTimeoutSeconds', 10);
    const dimOpacity = value('display.dimOpacity', 0.5);
    const dockAutoHide = value('display.dockAutoHide', true) ? 'Activado' : 'Desactivado';
    const wpSeconds = value('display.wallpaperIntervalSeconds', 35);
    const totalItems = collections.reduce((sum, c) => sum + Number(c.items?.length || 0), 0);

    el.querySelector('.settings-summary').innerHTML = `
      <article><strong>Plex</strong><span>${escapeHtml(plexUrl)}</span></article>
      <article><strong>Atenuación</strong><span>${escapeHtml(dimEnabled)} · ${Number(dimSeconds)}s · opacidad ${Number(dimOpacity)}</span></article>
      <article><strong>Dock</strong><span>Auto-ocultado: ${escapeHtml(dockAutoHide)}</span></article>
      <article><strong>Dashboard</strong><span>${Number(wpSeconds)}s por wallpaper · ${wallpapers.length} wallpapers</span></article>
      <article><strong>Colecciones</strong><span>${collections.length} colecciones · ${totalItems} imágenes</span></article>
      <article><strong>Admin avanzado</strong><span>Abre /admin.html desde un navegador normal de la LAN</span></article>`;
  }

  async function refresh() {
    const [s, w, c] = await Promise.all([api('/api/settings'), api('/api/wallpapers'), api('/api/collections')]);
    settings = s || {};
    wallpapers = w || [];
    collections = c || [];
    render();
  }

  return {
    id: 'settings',
    mount(target) {
      el = target;
      el.innerHTML = `<div class="settings-view settings-view--safe">
        <header>
          <div>
            <p class="eyebrow">SETTINGS</p>
            <h1>Configuración</h1>
            <p class="settings-note">Vista segura para Wallpaper Engine. La edición completa, subidas manuales y CSS avanzado están en <strong>/admin.html</strong>.</p>
          </div>
          <button data-refresh-settings>Actualizar</button>
        </header>
        <section class="settings-summary"></section>
      </div>`;
      el.querySelector('[data-refresh-settings]').addEventListener('click', () => refresh().then(() => ui.toast('Configuración actualizada')).catch(e => ui.alert(e.message || String(e))));
    },
    show() {
      isVisible = true;
      el.classList.add('view--active');
      el.setAttribute('aria-hidden', 'false');
      refresh().catch(console.error);
    },
    hide() {
      isVisible = false;
      el.classList.remove('view--active');
      el.setAttribute('aria-hidden', 'true');
    },
    update(data = {}) {
      if (data.settings) settings = data.settings;
      if (data.wallpapers) wallpapers = data.wallpapers;
      if (data.collections) collections = data.collections;
      if (isVisible) render();
    }
  };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}
