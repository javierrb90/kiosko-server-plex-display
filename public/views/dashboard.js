export function createDashboardView({ api, onTogglePrivacy } = {}) {
  let el, timer, clockTimer;
  let wallpapers = [];
  let settings = {};
  let currentId = null;
  let activeSlot = 0;
  let isVisible = false;
  let unreadCount = 0;
  let privacyLocked = false;

  async function loadWallpapers() {
    try { wallpapers = await api('/api/wallpapers'); }
    catch { wallpapers = []; }
  }

  function activeWallpapers() {
    return wallpapers.filter(w => (w.status || 'active') === 'active' && w.assetPath);
  }

  function pickWallpaper() {
    const pool = activeWallpapers();
    if (!pool.length) return null;
    if (pool.length === 1) return pool[0];
    const candidates = pool.filter(w => w.id !== currentId);
    return candidates[Math.floor(Math.random() * candidates.length)] || pool[0];
  }

  function renderWallpaper(force = false) {
    if (!el) return;
    const empty = el.querySelector('.dashboard-empty');
    const pool = activeWallpapers();
    if (!pool.length) {
      empty.hidden = false;
      currentId = null;
      el.querySelectorAll('.dashboard-wallpaper-img').forEach(img => { img.removeAttribute('src'); img.classList.remove('dashboard-wallpaper-img--visible'); });
      updateOverlay();
      return;
    }
    empty.hidden = true;
    const next = force ? pickWallpaper() : pickWallpaper();
    if (!next) return;
    currentId = next.id;
    const imgs = el.querySelectorAll('.dashboard-wallpaper-img');
    activeSlot = activeSlot ? 0 : 1;
    const img = imgs[activeSlot];
    const other = imgs[activeSlot ? 0 : 1];
    img.src = next.assetPath;
    img.classList.add('dashboard-wallpaper-img--visible');
    other.classList.remove('dashboard-wallpaper-img--visible');
    updateOverlay();
  }

  function schedule() {
    clearInterval(timer);
    const seconds = Number(settings.display?.wallpaperIntervalSeconds || 35);
    timer = setInterval(() => renderWallpaper(true), Math.max(5, seconds) * 1000);
  }

  function updateClock() {
    if (!el) return;
    const date = new Date();
    const text = `${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · ${date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`;
    const target = el.querySelector('.dashboard-date');
    if (target) target.textContent = text;
  }

  function updateOverlay() {
    if (!el) return;
    el.querySelector('.dashboard-unread').hidden = privacyLocked || unreadCount < 1;
    el.querySelector('.dashboard-unread').textContent = unreadCount === 1 ? '1 notificación nueva' : `${unreadCount} notificaciones nuevas`;
    const lock = el.querySelector('.privacy-lock-button');
    lock.classList.toggle('privacy-lock-button--locked', privacyLocked);
    lock.textContent = privacyLocked ? 'LOCK' : 'OPEN';
    lock.setAttribute('aria-label', privacyLocked ? 'Desactivar privacidad' : 'Activar privacidad');
    el.classList.toggle('dashboard-view--privacy', privacyLocked);
  }

  return {
    id: 'dashboard',
    mount(target) {
      el = target;
      el.innerHTML = `<div class="dashboard-view">
        <img class="dashboard-wallpaper-img dashboard-wallpaper-img--a" alt="">
        <img class="dashboard-wallpaper-img dashboard-wallpaper-img--b" alt="">
        <div class="dashboard-vignette"></div>
        <div class="dashboard-clock"><div class="dashboard-date"></div><button class="dashboard-unread" type="button" hidden></button></div>
        <button class="privacy-lock-button" type="button" aria-label="Activar privacidad">OPEN</button>
        <div class="dashboard-empty">Añade wallpapers desde Admin, Plex o Game.</div>
      </div>`;
      el.querySelector('.dashboard-unread').addEventListener('click', () => document.dispatchEvent(new CustomEvent('kiosk:navigate', { detail: { id: 'notifications' } })));
      el.querySelector('.privacy-lock-button').addEventListener('click', (event) => { event.stopPropagation(); onTogglePrivacy?.(); });
      updateClock();
      clockTimer = setInterval(updateClock, 1000);
    },
    async show() {
      isVisible = true;
      el.classList.add('view--active');
      el.setAttribute('aria-hidden', 'false');
      await loadWallpapers();
      renderWallpaper(!currentId);
      schedule();
    },
    hide() {
      isVisible = false;
      el.classList.remove('view--active');
      el.setAttribute('aria-hidden', 'true');
      clearInterval(timer);
    },
    async update(data = {}) {
      if (data.wallpapers) wallpapers = Array.isArray(data.wallpapers) ? data.wallpapers : [];
      settings = data.settings ?? settings;
      if (typeof data.unreadCount === 'number') unreadCount = data.unreadCount;
      if (typeof data.privacyLocked === 'boolean') privacyLocked = data.privacyLocked;
      updateOverlay();
      if (!wallpapers.length) await loadWallpapers();
      if (isVisible) {
        renderWallpaper(!currentId);
        schedule();
      }
    },
    destroy() { clearInterval(timer); clearInterval(clockTimer); }
  };
}
