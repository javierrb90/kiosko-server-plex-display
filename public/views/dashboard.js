export function createDashboardView({ api } = {}) {
  let el;
  let wallpapers = [];
  let currentId = null;
  let timer = null;
  let clockTimer = null;
  let settings = { display: {} };
  let isVisible = false;

  function activeWallpapers() {
    return wallpapers.filter(w => w && w.status !== "archived" && w.status !== "deleted" && w.assetPath);
  }

  function pickRandom(pool) {
    if (!pool.length) return null;
    const candidates = pool.length > 1 ? pool.filter(item => item.id !== currentId) : pool;
    return candidates[Math.floor(Math.random() * candidates.length)] || pool[0];
  }

  async function loadWallpapers(force = false) {
    if (!force && wallpapers.length) return;
    try {
      wallpapers = await api("/api/wallpapers");
    } catch (err) {
      console.error("No se pudieron cargar wallpapers", err);
    }
  }

  function renderWallpaper(forceNew = false) {
    if (!el) return;
    const imgA = el.querySelector(".dashboard-wallpaper-img--a");
    const imgB = el.querySelector(".dashboard-wallpaper-img--b");
    const empty = el.querySelector(".dashboard-empty");
    const pool = activeWallpapers();

    if (!pool.length) {
      imgA.removeAttribute("src");
      imgB.removeAttribute("src");
      imgA.classList.remove("dashboard-wallpaper-img--visible");
      imgB.classList.remove("dashboard-wallpaper-img--visible");
      empty.hidden = false;
      currentId = null;
      return;
    }

    empty.hidden = true;
    const item = forceNew || !currentId ? pickRandom(pool) : pool.find(w => w.id === currentId) || pickRandom(pool);
    if (!item) return;
    currentId = item.id;

    const currentImg = imgA.classList.contains("dashboard-wallpaper-img--visible") ? imgA : imgB;
    const nextImg = currentImg === imgA ? imgB : imgA;
    nextImg.src = item.assetPath;
    nextImg.alt = item.title || "Wallpaper";
    nextImg.classList.add("dashboard-wallpaper-img--visible");
    currentImg.classList.remove("dashboard-wallpaper-img--visible");
  }

  function schedule() {
    clearInterval(timer);
    const seconds = Number(settings.display?.wallpaperIntervalSeconds || 35);
    timer = setInterval(() => renderWallpaper(true), Math.max(5, seconds) * 1000);
  }

  function updateClock() {
    if (!el) return;
    const date = new Date();
    const text = `${date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} · ${date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}`;
    const target = el.querySelector(".dashboard-date");
    if (target) target.textContent = text;
  }

  return {
    id: "dashboard",
    mount(target) {
      el = target;
      el.innerHTML = `<div class="dashboard-view">
        <img class="dashboard-wallpaper-img dashboard-wallpaper-img--a" alt="">
        <img class="dashboard-wallpaper-img dashboard-wallpaper-img--b" alt="">
        <div class="dashboard-vignette"></div>
        <div class="dashboard-clock"><div class="dashboard-date"></div></div>
        <div class="dashboard-empty">Añade wallpapers desde Settings, Plex o Game.</div>
      </div>`;
      updateClock();
      clockTimer = setInterval(updateClock, 1000);
    },
    async show() {
      isVisible = true;
      el.classList.add("view--active");
      el.setAttribute("aria-hidden", "false");
      await loadWallpapers(true);
      renderWallpaper(true);
      schedule();
    },
    hide() {
      isVisible = false;
      el.classList.remove("view--active");
      el.setAttribute("aria-hidden", "true");
      clearInterval(timer);
    },
    async update(data = {}) {
      if (data.wallpapers) wallpapers = Array.isArray(data.wallpapers) ? data.wallpapers : [];
      settings = data.settings ?? settings;
      if (!wallpapers.length) await loadWallpapers(false);
      if (isVisible) {
        renderWallpaper(!currentId);
        schedule();
      }
    },
    destroy() { clearInterval(timer); clearInterval(clockTimer); }
  };
}
