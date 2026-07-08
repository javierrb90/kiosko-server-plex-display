function icon(source) { return ({ sonarr:"S", radarr:"R", plex:"P", playnite:"G", arr:"A", system:"•" }[source] || String(source || "?").slice(0,1).toUpperCase()); }
function dateLabel(value) { try { return new Date(value).toLocaleString("es-ES", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }); } catch { return ""; } }

export function createNotificationsView({ api, onViewed } = {}) {
  let el, page = 1, limit = 5;
  let data = { items: [], total: 0, totalPages: 1, page: 1 };
  async function load(nextPage = page) {
    data = await api(`/api/notifications?page=${nextPage}&limit=${limit}`);
    page = data.page;
    render();
  }
  function render() {
    const list = el.querySelector(".notification-list");
    el.querySelector(".notifications-count").textContent = `${data.total || 0} notificaciones`;
    el.querySelector(".notifications-page").textContent = `${data.page || 1} / ${data.totalPages || 1}`;
    if (!data.items?.length) { list.innerHTML = `<div class="notification-empty">Todavía no hay actividad registrada.</div>`; return; }
    list.innerHTML = data.items.map((item, index) => `<article class="notification-card ${index === 0 ? "notification-card--featured" : ""}">
      <div class="notification-source">${icon(item.source)}</div>
      <div class="notification-copy"><h2>${item.title || "Nueva notificación"}</h2><p>${item.subtitle || item.type || ""}</p><time>${dateLabel(item.createdAt)}</time></div>
    </article>`).join("");
  }
  return {
    id: "notifications",
    mount(target) {
      el = target;
      el.innerHTML = `<div class="notifications-shell"><header><p class="eyebrow">CENTRO DE ACTIVIDAD</p><div><span class="notifications-count">0 eventos</span><span class="notifications-page">1 / 1</span></div></header><section class="notification-list"></section><footer><button class="nav-btn" data-prev>‹</button><button class="nav-btn" data-next>›</button></footer></div>`;
      el.querySelector("[data-prev]").addEventListener("click", () => load(Math.max(1, page - 1)));
      el.querySelector("[data-next]").addEventListener("click", () => load(Math.min(data.totalPages || 1, page + 1)));
    },
    show() { el.classList.add("view--active"); el.setAttribute("aria-hidden", "false"); onViewed?.(); load(page).catch(console.error); },
    hide() { el.classList.remove("view--active"); el.setAttribute("aria-hidden", "true"); },
    update(payload = {}) { if (payload.settings?.views?.notifications?.itemsPerPage) limit = payload.settings.views.notifications.itemsPerPage; if (payload.notifications) { data = payload.notifications; limit = payload.notifications.limit || limit; page = payload.notifications.page || page; render(); } },
    notify() { load(1).catch(console.error); }
  };
}
