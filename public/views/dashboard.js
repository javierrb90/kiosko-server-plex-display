export function createDashboardView({ api, onTogglePrivacy } = {}) {
  let el, timer;
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

  function currentWallpaperStillAvailable() {
    if (!currentId) return false;
    return activeWallpapers().some(w => w.id === currentId);
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

  function lockSvg(locked) {
    return locked
      ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1Zm2 0h6V8a3 3 0 0 0-6 0v2Z"/></svg>`
      : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 9h-2V7a3 3 0 0 0-5.6-1.5L7.7 4.4A5 5 0 0 1 17 7v2h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1h11Z"/></svg>`;
  }

  function updateOverlay() {
    if (!el) return;
    el.querySelector('.dashboard-unread').hidden = privacyLocked || unreadCount < 1;
    el.querySelector('.dashboard-unread').textContent = unreadCount === 1 ? '1 notificación nueva' : `${unreadCount} notificaciones nuevas`;
    const lock = el.querySelector('.privacy-lock-button');
    lock.classList.toggle('privacy-lock-button--locked', privacyLocked);
    lock.innerHTML = privacyLocked ? lockSvg(true) : lockSvg(false);
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
        <button class="dashboard-unread" type="button" hidden></button>
        <button class="privacy-lock-button" type="button" aria-label="Activar privacidad"></button>
        <div class="dashboard-empty">Añade wallpapers desde Admin, Plex o Game.</div>
      </div>`;
      el.querySelector('.dashboard-unread').addEventListener('click', (event) => {
        event.stopPropagation();
        document.dispatchEvent(new CustomEvent('kiosk:navigate', { detail: { id: 'notifications' } }));
      });
      el.querySelector('.privacy-lock-button').addEventListener('click', (event) => { event.stopPropagation(); onTogglePrivacy?.(); });
    },
    async show() {
      isVisible = true;
      el.classList.add('view--active');
      el.setAttribute('aria-hidden', 'false');
      await loadWallpapers();
      if (!currentWallpaperStillAvailable()) renderWallpaper(true);
      else updateOverlay();
      schedule();
    },
    hide() {
      isVisible = false;
      el.classList.remove('view--active');
      el.setAttribute('aria-hidden', 'true');
      clearInterval(timer);
    },
    async update(data = {}) {
      const hasWallpaperUpdate = Object.prototype.hasOwnProperty.call(data, 'wallpapers');
      if (hasWallpaperUpdate) wallpapers = Array.isArray(data.wallpapers) ? data.wallpapers : [];
      settings = data.settings ?? settings;
      if (typeof data.unreadCount === 'number') unreadCount = data.unreadCount;
      if (typeof data.privacyLocked === 'boolean') privacyLocked = data.privacyLocked;
      updateOverlay();
      if (!wallpapers.length && !hasWallpaperUpdate) await loadWallpapers();
      if (isVisible) {
        const mustPickWallpaper = !currentWallpaperStillAvailable();
        if (mustPickWallpaper) renderWallpaper(true);
        else updateOverlay();
        schedule();
      }
    },
    destroy() { clearInterval(timer); }
  };
}
