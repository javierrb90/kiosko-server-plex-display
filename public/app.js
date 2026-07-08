import { ViewManager } from "/core/view-manager.js";
import { SocketClient } from "/core/socket-client.js";
import { createUi } from "/core/ui.js";
import { createDashboardView } from "/views/dashboard.js";
import { createNotificationsView } from "/views/notifications.js";
import { createPlexView } from "/views/plex-now-playing.js";
import { createGameView } from "/views/game-now-playing.js";
import { createCollectionsView } from "/views/collections.js";
import { createSettingsView } from "/views/settings.js";

const DEBUG_PREFIX = "[Kiosko UI]";
const debug = (...args) => console.log(DEBUG_PREFIX, ...args);
const debugError = (...args) => console.error(DEBUG_PREFIX, ...args);

const appRoot = document.getElementById("app");
const dock = document.getElementById("dock");
const toast = document.getElementById("toast");
const dimOverlay = document.getElementById("dim-overlay");
const modalRoot = document.getElementById("modal-root");
const uiToastRoot = document.getElementById("ui-toast-root");
const ui = createUi({ modalRoot, toastRoot: uiToastRoot });

const state = {
  settings: null,
  activeView: "dashboard",
  dimTimer: null,
  toastTimer: null,
  dockTimer: null,
  latestNotification: null
};

const views = new ViewManager(appRoot, { debug });

function api(path, options = {}) {
  const headers = options.body && !(options.body instanceof FormData) && !options.headers?.["Content-Type"]
    ? { "Content-Type": "application/json", ...(options.headers || {}) }
    : options.headers || {};
  return fetch(path, { ...options, headers }).then(async res => {
    const isJson = String(res.headers.get("content-type") || "").includes("application/json");
    const data = isJson ? await res.json() : await res.text();
    if (!res.ok) throw new Error(data?.error || data || `HTTP ${res.status}`);
    return data;
  });
}

function refreshCustomCss(name) {
  const links = name ? [...document.querySelectorAll(`[data-custom-css="${name}"]`)] : [...document.querySelectorAll("[data-custom-css]")];
  for (const link of links) {
    const base = link.getAttribute("href").split("?")[0];
    link.setAttribute("href", `${base}?v=${Date.now()}`);
  }
}


function isCompatMode() {
  const params = new URLSearchParams(window.location.search);
  return params.has("compat") || params.has("wallpaperEngine") || params.has("safe");
}

function applyDisplaySettings() {
  document.body.classList.toggle("compat-mode", isCompatMode());
  document.body.classList.toggle("dock-autohide", state.settings?.display?.dockAutoHide !== false);
}

function clearDockTimer() {
  clearTimeout(state.dockTimer);
  state.dockTimer = null;
}

function hideDock() {
  if (state.settings?.display?.dockAutoHide === false) return;
  document.body.classList.remove("dock-visible");
}

function showDock({ temporary = true } = {}) {
  document.body.classList.add("dock-visible");
  clearDockTimer();
  if (!temporary || state.settings?.display?.dockAutoHide === false) return;
  const seconds = Number(state.settings?.display?.dockAutoHideSeconds || 4);
  state.dockTimer = setTimeout(hideDock, Math.max(1, seconds) * 1000);
}

function dimmableView(id = state.activeView) {
  return ["notifications", "plex-now-playing", "game-now-playing"].includes(id);
}
function clearDimTimer() { clearTimeout(state.dimTimer); state.dimTimer = null; }
function setDimmed(dimmed) { dimOverlay.classList.toggle("dim-overlay--active", Boolean(dimmed)); }
function resetDimTimer(reason = "interacción") {
  clearDimTimer();
  setDimmed(false);
  const settings = state.settings || {};
  if (!settings.display?.dimEnabled || !dimmableView()) return;
  const seconds = Number(settings.display?.dimTimeoutSeconds || 10);
  const opacity = Number(settings.display?.dimOpacity ?? 0.5);
  dimOverlay.style.setProperty("--dim-opacity", String(opacity));
  state.dimTimer = setTimeout(() => {
    debug("Atenuando vista", { view: state.activeView, reason });
    setDimmed(true);
  }, Math.max(1, seconds) * 1000);
}
function navigate(id, { persist = true, reason = "dock" } = {}) {
  if (!id) return;
  showDock();
  state.activeView = id;
  views.show(id, { reason });
  dock.querySelectorAll("button").forEach(btn => btn.classList.toggle("dock__item--active", btn.dataset.nav === id));
  setDimmed(false);
  resetDimTimer(`navegación: ${reason}`);
  if (persist) api("/api/state", { method: "PUT", body: JSON.stringify({ activeView: id }) }).catch(debugError);
}
function showToast(notification) {
  if (!state.settings?.notifications?.toastEnabled) return;
  state.latestNotification = notification;
  clearTimeout(state.toastTimer);
  toast.hidden = false;
  toast.innerHTML = `<strong>${notification.title || "Nueva notificación"}</strong><span>${notification.subtitle || notification.source || ""}</span>`;
  toast.classList.add("event-toast--visible");
  const seconds = Number(state.settings?.notifications?.toastDurationSeconds || 6);
  state.toastTimer = setTimeout(() => toast.classList.remove("event-toast--visible"), seconds * 1000);
}

views.register(createDashboardView({ api, debug }));
views.register(createNotificationsView({ api, debug }));
views.register(createPlexView({ api, debug, ui }));
views.register(createGameView({ api, debug, ui }));
views.register(createCollectionsView({ api, debug, ui }));
views.register(createSettingsView({ api, debug, refreshCustomCss, ui }));

function applyState(payload = {}) {
  debug("Snapshot recibido", payload);
  state.settings = payload.settings || state.settings;
  applyDisplaySettings();
  views.update("dashboard", { wallpapers: payload.wallpapers || [], settings: state.settings });
  views.update("notifications", { notifications: payload.notifications, settings: state.settings });
  views.update("plex-now-playing", payload.plex);
  views.update("game-now-playing", payload.game);
  views.update("collections", { collections: payload.collections || [], state: payload.state });
  views.update("settings", { settings: state.settings, wallpapers: payload.wallpapers || [], collections: payload.collections || [] });
  const initial = "dashboard";
  if (!views.activeId) navigate(initial, { persist: false, reason: "snapshot inicial" });
  resetDimTimer("snapshot");
}

const socket = new SocketClient({
  onMessage(message) {
    debug("Mensaje WebSocket recibido", message?.type, message?.payload);
    if (message.type === "state:snapshot") return applyState(message.payload);
    if (message.type === "settings:update") { state.settings = message.payload; applyDisplaySettings(); views.update("dashboard", { settings: state.settings }); views.update("settings", { settings: state.settings }); resetDimTimer("settings update"); showDock(); return; }
    if (message.type === "wallpapers:update") { views.update("dashboard", { wallpapers: message.payload || [], settings: state.settings }); views.update("settings", { wallpapers: message.payload || [] }); return; }
    if (message.type === "collections:update") { views.update("collections", { collections: message.payload || [] }); views.update("settings", { collections: message.payload || [] }); return; }
    if (message.type === "custom-css:update") { refreshCustomCss(message.payload?.name); return; }
    if (message.type === "plex:update") { views.update("plex-now-playing", message.payload); resetDimTimer("plex update"); return; }
    if (message.type === "game:update") { views.update("game-now-playing", message.payload); resetDimTimer("game update"); return; }
    if (message.type === "notification:new") {
      views.notify("notifications", message.payload);
      showToast(message.payload);
      resetDimTimer("nueva notificación");
      return;
    }
    if (message.type === "view:show") {
      const id = message.payload?.id || "dashboard";
      navigate(id, { persist: false, reason: message.payload?.reason || "servidor" });
      return;
    }
  },
  onOpen() { debug("WebSocket conectado"); },
  onClose() { debug("WebSocket desconectado; se reintentará la conexión"); },
  onError(event) { debugError("Error de WebSocket", event); }
});

dock.addEventListener("pointerdown", event => {
  event.stopPropagation();
  showDock();
});
dock.addEventListener("click", event => {
  const btn = event.target.closest("button[data-nav]");
  if (!btn) return;
  navigate(btn.dataset.nav, { reason: "dock" });
});
toast.addEventListener("click", () => {
  toast.classList.remove("event-toast--visible");
  navigate("notifications", { reason: "toast" });
});
window.addEventListener("pointerdown", event => {
  resetDimTimer("pointerdown");
  if (!event.target.closest("#dock")) showDock();
}, { passive: true });
window.addEventListener("keydown", () => { resetDimTimer("keydown"); showDock(); });
window.addEventListener("error", event => debugError("Error no controlado", { message: event.message, filename: event.filename, line: event.lineno }));

applyDisplaySettings();
// El dock flota oculto por defecto; un toque/clic en cualquier punto lo muestra.
if (state.settings?.display?.dockAutoHide === false) showDock({ temporary: false });
socket.connect();
