const esc = value => String(value ?? "").replace(/[&<>"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[char]));
function icon(source) { return ({ plex: "▶", sonarr: "S", radarr: "R", arr: "A", playnite: "🎮", system: "•" }[source] || "•"); }
function render(el, data) {
  const { items = [], page = 1, totalPages = 1, total = 0 } = data || {};
  el.querySelector(".notification-count").textContent = `${total} EVENTOS`;
  el.querySelector(".notification-page").textContent = total ? `${page} / ${totalPages}` : "";
  el.querySelector(".notification-list").innerHTML = items.length ? items.map(item => `<article class="notification-card"><div class="notification-source">${icon(item.source)}</div><div class="notification-copy"><h2>${esc(item.title)}</h2><p>${esc(item.subtitle)}</p><time>${new Date(item.createdAt).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}</time></div></article>`).join("") : `<div class="notification-empty">No hay notificaciones todavía.</div>`;
}
export function createNotificationsView({ onSleep = () => {}, onInteraction = () => {}, getLimit = () => 5 } = {}) {
  let el;
  let state = { page: 1, totalPages: 1 };
  let config = { showManualPowerButton: true, showSettingsButton: true };

  async function load(page = 1) {
    const response = await fetch(`/api/notifications?page=${page}&limit=${getLimit()}`);
    const data = await response.json();
    state = data;
    render(el, data);
  }

  function applyConfig(nextConfig = {}) {
    config = { ...config, ...nextConfig };
    const sleepButton = el?.querySelector(".sleep-btn");
    const settingsButton = el?.querySelector(".settings-btn");
    if (sleepButton) sleepButton.hidden = !config.showManualPowerButton;
    if (settingsButton) settingsButton.hidden = !config.showSettingsButton;
  }

  return {
    id: "notifications",
    mount(target) {
      el = target;
      el.innerHTML = `<div class="notifications-shell"><header><p class="eyebrow">CENTRO DE NOTIFICACIONES</p><div class="notifications-header-meta"><span class="notification-count">0 EVENTOS</span><span class="notification-page"></span><a class="settings-btn" href="/settings.html" aria-label="Ajustes" title="Ajustes">⚙</a><button class="sleep-btn" type="button" aria-label="Apagar pantalla" title="Apagar pantalla">⏻</button></div></header><div class="notification-list"></div><footer><button class="nav-btn" data-direction="-1" aria-label="Página anterior">‹</button><button class="nav-btn" data-direction="1" aria-label="Página siguiente">›</button></footer></div>`;
      el.querySelectorAll(".nav-btn").forEach(button => button.addEventListener("click", () => {
        const next = state.page + Number(button.dataset.direction);
        if (next >= 1 && next <= state.totalPages) {
          onInteraction();
          load(next);
        }
      }));
      el.querySelector(".sleep-btn").addEventListener("click", event => {
        event.stopPropagation();
        onSleep();
      });
      el.querySelector(".settings-btn").addEventListener("click", event => {
        event.stopPropagation();
      });
      el.addEventListener("pointerdown", event => {
        if (!event.target.closest(".sleep-btn") && !event.target.closest(".settings-btn")) onInteraction();
      });
      applyConfig(config);
    },
    show() { el.classList.add("view--active"); el.setAttribute("aria-hidden", "false"); },
    hide() { el.classList.remove("view--active"); el.setAttribute("aria-hidden", "true"); },
    update(data) { state = data || state; render(el, state); },
    notify() { load(1); },
    configure(nextConfig) { applyConfig(nextConfig); load(Math.min(state.page || 1, state.totalPages || 1)); }
  };
}
