import { SocketClient } from "/core/socket-client.js";
import { ViewManager } from "/core/view-manager.js";
import { createUi } from "/core/ui.js";
import { createDashboardView } from "/views/dashboard.js";
import { createPlexView } from "/views/plex-now-playing.js";
import { createGameView } from "/views/game-now-playing.js";
import { createCollectionsView } from "/views/collections.js";

const DEBUG_PREFIX = "[Kiosko UI]";
const debug = (...args) => console.log(DEBUG_PREFIX, ...args);
const debugError = (...args) => console.error(DEBUG_PREFIX, ...args);

const appRoot = document.getElementById("app");
const dock = document.getElementById("dock");
const toast = document.getElementById("toast");
const notificationsTrigger = document.getElementById("notifications-trigger");
const notificationsBadge = document.querySelector("[data-notifications-badge]");
const notificationsOverlay = document.getElementById("notifications-overlay");
const notificationsOverlayList = document.querySelector("[data-notifications-overlay-list]");
const notificationsOverlayCount = document.querySelector("[data-notifications-overlay-count]");
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
  latestNotification: null,
  notificationsOverlayOpen: false,
  overlayNotifications: [],
  notificationsPage: 1,
  notificationsPerPage: 6
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


function notificationIcon(item = {}) {
  const key = String(item.source || item.type || "system").toLowerCase();
  if (key.includes("sonarr")) return `<svg viewBox="0 0 24 24"><path d="M5 4h14v16H5V4Zm2 2v3h10V6H7Zm0 5v3h10v-3H7Zm0 5v2h10v-2H7Z"/></svg>`;
  if (key.includes("radarr")) return `<svg viewBox="0 0 24 24"><path d="M4 6h16v12H4V6Zm3 2-1 2h3l1-2H7Zm5 0-1 2h3l1-2h-3Zm5 0-1 2h2v-2h-1ZM7 13v3h10v-3H7Z"/></svg>`;
  if (key.includes("plex")) return `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7L8 5Z"/></svg>`;
  if (key.includes("grab") || key.includes("download")) return `<svg viewBox="0 0 24 24"><path d="M11 4h2v9l3.5-3.5 1.4 1.4L12 16.8l-5.9-5.9 1.4-1.4L11 13V4ZM5 19h14v2H5v-2Z"/></svg>`;
  return `<svg viewBox="0 0 24 24"><path d="M12 22a2.4 2.4 0 0 0 2.3-1.7H9.7A2.4 2.4 0 0 0 12 22Zm7-5-1.7-2.2V10a5.3 5.3 0 0 0-4-5.1V3a1.3 1.3 0 1 0-2.6 0v1.9a5.3 5.3 0 0 0-4 5.1v4.8L5 17v1.2h14V17Z"/></svg>`;
}
function relativeTime(value) {
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return "";
  const diff = Math.max(0, Date.now() - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Ahora";
  if (min < 60) return `Hace ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} d`;
}
function getNotificationsPerPage() {
  const width = window.innerWidth || document.documentElement.clientWidth || 960;
  const height = window.innerHeight || document.documentElement.clientHeight || 540;
  if (width >= 860) return 6;
  return 4;
}
function renderNotificationsOverlay() {
  if (!notificationsOverlayList) return;
  state.notificationsPerPage = getNotificationsPerPage();
  const items = state.overlayNotifications || [];
  const totalPages = Math.max(1, Math.ceil(items.length / state.notificationsPerPage));
  state.notificationsPage = Math.min(Math.max(1, state.notificationsPage || 1), totalPages);
  const start = (state.notificationsPage - 1) * state.notificationsPerPage;
  const visible = items.slice(start, start + state.notificationsPerPage);
  if (notificationsOverlayCount) {
    notificationsOverlayCount.textContent = items.length
      ? `${state.notificationsPage} / ${totalPages} · ${items.length} recientes`
      : "Sin actividad reciente";
  }
  const prev = notificationsOverlay?.querySelector('[data-notifications-prev]');
  const next = notificationsOverlay?.querySelector('[data-notifications-next]');
  if (prev) prev.disabled = state.notificationsPage <= 1;
  if (next) next.disabled = state.notificationsPage >= totalPages;
  if (!visible.length) {
    notificationsOverlayList.innerHTML = `<div class="notifications-panel__empty">No hay notificaciones recientes.</div>`;
    return;
  }
  notificationsOverlayList.innerHTML = visible.map((item) => `<article class="overlay-notification ${item.unread ? "overlay-notification--unread" : ""}">
    <div class="overlay-notification__icon" aria-hidden="true">${notificationIcon(item)}</div>
    <div class="overlay-notification__copy">
      <h2>${escapeHtml(item.title || "Nueva notificación")}</h2>
      <p>${escapeHtml(item.subtitle || item.type || item.source || "")}</p>
      <time>${escapeHtml(relativeTime(item.createdAt))}</time>
    </div>
  </article>`).join("");
}
async function markNotificationsViewed() {
  const now = new Date().toISOString();
  state.runtime = { ...(state.runtime || {}), lastNotificationsViewedAt: now };
  state.unreadCount = 0;
  state.overlayNotifications = state.overlayNotifications.map(item => ({ ...item, unread: false }));
  renderNotificationsOverlay();
  views.update("dashboard", { unreadCount: 0, privacyLocked: state.privacyLocked });
  updateNotificationsTrigger();
  await api("/api/state", { method: "PUT", body: JSON.stringify({ lastNotificationsViewedAt: now }) }).catch(debugError);
}
async function loadOverlayNotifications() {
  const result = await api("/api/notifications?page=1&limit=25");
  const lastViewed = Date.parse(state.runtime?.lastNotificationsViewedAt || "");
  state.overlayNotifications = (result.items || []).map(item => ({ ...item, unread: Number.isFinite(lastViewed) ? Date.parse(item.createdAt) > lastViewed : true }));
  renderNotificationsOverlay();
}
async function openNotificationsOverlay({ markViewed = true } = {}) {
  if (state.privacyLocked) return;
  state.notificationsPage = 1;
  await loadOverlayNotifications().catch(debugError);
  if (markViewed) await markNotificationsViewed();
  state.notificationsOverlayOpen = true;
  notificationsOverlay.hidden = false;
  notificationsOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("notifications-overlay-open");
  hideDock(true);
  setDimmed(false);
}
function closeNotificationsOverlay() {
  state.notificationsOverlayOpen = false;
  notificationsOverlay.hidden = true;
  notificationsOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("notifications-overlay-open");
}

function updateNotificationsTrigger() {
  if (!notificationsTrigger) return;
  notificationsTrigger.hidden = Boolean(state.privacyLocked);
  if (!notificationsBadge) return;
  const count = Math.max(0, Number(state.unreadCount || 0));
  notificationsBadge.hidden = count < 1;
  notificationsBadge.textContent = count > 99 ? "99+" : String(count);
  notificationsTrigger.classList.toggle("notifications-trigger--unread", count > 0);
}

function applyDisplaySettings() {
  document.body.classList.toggle("dock-autohide", state.settings?.display?.dockAutoHide !== false);
  document.body.classList.toggle("privacy-locked", Boolean(state.privacyLocked));
  if (state.privacyLocked) {
    hideDock(true);
    closeNotificationsOverlay();
    setDimmed(false);
  }
  updateNotificationsTrigger();
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
  return ["plex-now-playing", "game-now-playing"].includes(id);
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
      state.overlayNotifications.unshift({ ...message.payload, unread: true });
      state.overlayNotifications = state.overlayNotifications.slice(0, 25);
      renderNotificationsOverlay();
      views.update("dashboard", { unreadCount: state.unreadCount, privacyLocked: state.privacyLocked });
      updateNotificationsTrigger();
      showNotificationToast(message.payload);
      resetDimTimer("nueva notificación");
      return;
    }
    if (message.type === "view:show") {
      const id = message.payload?.id || "dashboard";
      if (id === "notifications") { openNotificationsOverlay().catch(debugError); return; }
      closeNotificationsOverlay();
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
  closeNotificationsOverlay();
  navigate(btn.dataset.nav, { reason: "dock" });
});
notificationsTrigger?.addEventListener("click", (event) => {
  event.stopPropagation();
  openNotificationsOverlay().catch(debugError);
});
toast.addEventListener("click", () => {
  if (state.privacyLocked) return;
  toast.classList.remove("event-toast--visible");
  openNotificationsOverlay().catch(debugError);
});
window.addEventListener("pointerdown", event => {
  resetDimTimer("pointerdown");
  if (!state.notificationsOverlayOpen && !event.target.closest("#dock") && !event.target.closest(".privacy-lock-button")) showDock();
}, { passive: true });
window.addEventListener("keydown", () => { resetDimTimer("keydown"); showDock(); });
notificationsOverlay.addEventListener("click", event => {
  if (event.target.closest("[data-close-notifications]")) closeNotificationsOverlay();
  if (event.target.closest("[data-notifications-prev]")) { state.notificationsPage -= 1; renderNotificationsOverlay(); }
  if (event.target.closest("[data-notifications-next]")) { state.notificationsPage += 1; renderNotificationsOverlay(); }
});
window.addEventListener("resize", () => {
  if (state.notificationsOverlayOpen) renderNotificationsOverlay();
});
document.addEventListener("kiosk:open-notifications", () => openNotificationsOverlay().catch(debugError));
document.addEventListener("kiosk:navigate", event => {
  const id = event.detail?.id;
  if (id === "notifications") return openNotificationsOverlay().catch(debugError);
  closeNotificationsOverlay();
  navigate(id, { reason: "dashboard" });
});
window.addEventListener("error", event => debugError("Error no controlado", { message: event.message, filename: event.filename, line: event.lineno }));

applyDisplaySettings();
socket.connect();

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}
