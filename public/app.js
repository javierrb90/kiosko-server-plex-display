import { SocketClient } from "/core/socket-client.js";
import { ViewManager } from "/core/view-manager.js";
import { createUi } from "/core/ui.js";
import { createDashboardView } from "/views/dashboard.js";
import { createNotificationsView } from "/views/notifications.js";
import { createPlexView } from "/views/plex-now-playing.js";
import { createGameView } from "/views/game-now-playing.js";
import { createCollectionsView } from "/views/collections.js";

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
  runtime: {},
  activeView: "dashboard",
  privacyLocked: false,
  unreadCount: 0,
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

function applyDisplaySettings() {
  document.body.classList.toggle("dock-autohide", state.settings?.display?.dockAutoHide !== false);
  document.body.classList.toggle("privacy-locked", Boolean(state.privacyLocked));
  if (state.privacyLocked) {
    hideDock(true);
    setDimmed(false);
  }
}

function clearDockTimer() { clearTimeout(state.dockTimer); state.dockTimer = null; }
function hideDock(force = false) {
  if (!force && state.settings?.display?.dockAutoHide === false) return;
  document.body.classList.remove("dock-visible");
}
function showDock({ temporary = true } = {}) {
  if (state.privacyLocked) return;
  document.body.classList.add("dock-visible");
  clearDockTimer();
  if (!temporary || state.settings?.display?.dockAutoHide === false) return;
  const seconds = Number(state.settings?.display?.dockAutoHideSeconds || 4);
  state.dockTimer = setTimeout(() => hideDock(), Math.max(1, seconds) * 1000);
}

function dimmableView(id = state.activeView) {
  if (state.privacyLocked) return false;
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

function navigate(id, { persist = true, reason = "dock", force = false } = {}) {
  if (!id) return;
  if (state.privacyLocked && id !== "dashboard" && !force) {
    debug("Navegación bloqueada por privacidad", { id, reason });
    return;
  }
  if (!state.privacyLocked) showDock();
  state.activeView = id;
  views.show(id, { reason });
  dock.querySelectorAll("button").forEach(btn => btn.classList.toggle("dock__item--active", btn.dataset.nav === id));
  setDimmed(false);
  resetDimTimer(`navegación: ${reason}`);
  if (persist) api("/api/state", { method: "PUT", body: JSON.stringify({ activeView: id }) }).catch(debugError);
}

async function setPrivacyLocked(locked) {
  state.privacyLocked = Boolean(locked);
  applyDisplaySettings();
  if (state.privacyLocked) navigate("dashboard", { persist: false, reason: "privacy lock", force: true });
  views.update("dashboard", { privacyLocked: state.privacyLocked, unreadCount: state.unreadCount });
  await api("/api/state", { method: "PUT", body: JSON.stringify({ privacyLocked: state.privacyLocked, activeView: state.privacyLocked ? "dashboard" : state.activeView }) }).catch(debugError);
}

function showNotificationToast(notification) {
  if (state.privacyLocked) return;
  if (!state.settings?.notifications?.toastEnabled) return;
  state.latestNotification = notification;
  clearTimeout(state.toastTimer);
  toast.hidden = false;
  toast.innerHTML = `<strong>${escapeHtml(notification.title || "Nueva notificación")}</strong><span>${escapeHtml(notification.subtitle || notification.source || "")}</span>`;
  toast.classList.add("event-toast--visible");
  const seconds = Number(state.settings?.notifications?.toastDurationSeconds || 6);
  state.toastTimer = setTimeout(() => toast.classList.remove("event-toast--visible"), seconds * 1000);
}

views.register(createDashboardView({ api, debug, onTogglePrivacy: () => setPrivacyLocked(!state.privacyLocked) }));
views.register(createNotificationsView({ api, debug, onViewed: async () => {
  const now = new Date().toISOString();
  state.unreadCount = 0;
  views.update("dashboard", { unreadCount: 0, privacyLocked: state.privacyLocked });
  await api("/api/state", { method: "PUT", body: JSON.stringify({ lastNotificationsViewedAt: now }) }).catch(debugError);
}}));
views.register(createPlexView({ api, debug, ui }));
views.register(createGameView({ api, debug, ui }));
views.register(createCollectionsView({ api, debug, ui }));

function applyState(payload = {}) {
  debug("Snapshot recibido", payload);
  state.settings = payload.settings || state.settings;
  state.runtime = payload.state || state.runtime || {};
  state.privacyLocked = Boolean(payload.state?.privacyLocked);
  state.unreadCount = Number(payload.unreadCount || 0);
  applyDisplaySettings();
  views.update("dashboard", { wallpapers: payload.wallpapers || [], settings: state.settings, unreadCount: state.unreadCount, privacyLocked: state.privacyLocked });
  views.update("notifications", { notifications: payload.notifications, settings: state.settings });
  views.update("plex-now-playing", payload.plex);
  views.update("game-now-playing", payload.game);
  views.update("collections", { collections: payload.collections || [], state: payload.state });
  if (!views.activeId) navigate("dashboard", { persist: false, reason: "snapshot inicial", force: true });
  if (state.privacyLocked) navigate("dashboard", { persist: false, reason: "privacy snapshot", force: true });
  resetDimTimer("snapshot");
}

const socket = new SocketClient({
  onMessage(message) {
    debug("Mensaje WebSocket recibido", message?.type, message?.payload);
    if (message.type === "state:snapshot") return applyState(message.payload);
    if (message.type === "settings:update") { state.settings = message.payload; applyDisplaySettings(); views.update("dashboard", { settings: state.settings }); resetDimTimer("settings update"); if (!state.privacyLocked) showDock(); return; }
    if (message.type === "wallpapers:update") { views.update("dashboard", { wallpapers: message.payload || [], settings: state.settings }); return; }
    if (message.type === "collections:update") { views.update("collections", { collections: message.payload || [] }); return; }
    if (message.type === "custom-css:update") { refreshCustomCss(message.payload?.name); return; }
    if (message.type === "plex:update") { views.update("plex-now-playing", message.payload); resetDimTimer("plex update"); return; }
    if (message.type === "game:update") { views.update("game-now-playing", message.payload); resetDimTimer("game update"); return; }
    if (message.type === "notification:new") {
      state.unreadCount += 1;
      views.notify("notifications", message.payload);
      views.update("dashboard", { unreadCount: state.unreadCount, privacyLocked: state.privacyLocked });
      showNotificationToast(message.payload);
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
  if (state.privacyLocked) return;
  toast.classList.remove("event-toast--visible");
  navigate("notifications", { reason: "toast" });
});
window.addEventListener("pointerdown", event => {
  resetDimTimer("pointerdown");
  if (!event.target.closest("#dock") && !event.target.closest(".privacy-lock-button")) showDock();
}, { passive: true });
window.addEventListener("keydown", () => { resetDimTimer("keydown"); showDock(); });
document.addEventListener("kiosk:navigate", event => navigate(event.detail?.id, { reason: "dashboard" }));
window.addEventListener("error", event => debugError("Error no controlado", { message: event.message, filename: event.filename, line: event.lineno }));

applyDisplaySettings();
socket.connect();

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}
