import { ViewManager } from "/core/view-manager.js";
import { SocketClient } from "/core/socket-client.js";
import { createPlexView } from "/views/plex-now-playing.js";
import { createGameView } from "/views/game-now-playing.js";
import { createNotificationsView } from "/views/notifications.js";

const DEBUG_PREFIX = "[Kiosko UI]";
const debug = (...args) => console.log(DEBUG_PREFIX, ...args);
const debugError = (...args) => console.error(DEBUG_PREFIX, ...args);

const DEFAULT_SETTINGS = {
  display: { fadeToBlackEnabled: true, dashboardIdleTimeoutSeconds: 30, wakeOnAnyTouch: true },
  views: {
    notifications: { itemsPerPage: 5, showManualPowerButton: true, showSettingsButton: true },
    plex: { enabled: true, popupDurationSeconds: 5, showProgressBar: true },
    playnite: { enabled: true, popupDurationSeconds: 5, showProgressBar: true }
  }
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }
let settings = clone(DEFAULT_SETTINGS);

function merge(base, override) {
  if (!override || typeof override !== "object") return base;
  const output = Array.isArray(base) ? [...base] : { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === "object" && !Array.isArray(value) && output[key] && typeof output[key] === "object" && !Array.isArray(output[key])) output[key] = merge(output[key], value);
    else output[key] = value;
  }
  return output;
}

function applySettings(nextSettings = {}) {
  settings = merge(clone(DEFAULT_SETTINGS), nextSettings);
  debug("Configuración aplicada", settings);
  views.call("notifications", "configure", {
    ...settings.views.notifications,
    showManualPowerButton: settings.display?.fadeToBlackEnabled && settings.views.notifications?.showManualPowerButton
  });
  views.call("plex-now-playing", "configure", settings.views.plex);
  views.call("game-now-playing", "configure", settings.views.playnite);
}

function getNotificationLimit() {
  return Number(settings.views?.notifications?.itemsPerPage) || 5;
}

function dashboardAwakeDurationMs() {
  if (!settings.display?.fadeToBlackEnabled) return 0;
  const seconds = Number(settings.display?.dashboardIdleTimeoutSeconds);
  return seconds > 0 ? seconds * 1000 : 0;
}

function temporaryDurationMs(id) {
  const seconds = id === "game-now-playing"
    ? Number(settings.views?.playnite?.popupDurationSeconds)
    : Number(settings.views?.plex?.popupDurationSeconds);
  return Math.max(1000, (seconds || 5) * 1000);
}

function customCssLinks() {
  return [...document.querySelectorAll('link[href^="/custom-css/"]')];
}

function refreshCustomCss() {
  const stamp = Date.now();
  for (const link of customCssLinks()) {
    const base = link.href.split("?")[0];
    link.href = `${base}?v=${stamp}`;
  }
}

const views = new ViewManager(document.getElementById("app"), { debug });
let temporaryViewTimer = null;
let temporaryViewId = null;

const sleepOverlay = document.getElementById("sleep-overlay");
let asleep = true;
let sleepTimer = null;

function clearSleepTimer() {
  clearTimeout(sleepTimer);
  sleepTimer = null;
}

function clearTemporaryViewTimer() {
  clearTimeout(temporaryViewTimer);
  temporaryViewTimer = null;
  if (temporaryViewId) views.call(temporaryViewId, "stopTimer");
  temporaryViewId = null;
}

function waitForSleepFade() {
  if (!settings.display?.fadeToBlackEnabled || !sleepOverlay.classList.contains("sleep-overlay--active")) return Promise.resolve();

  return new Promise(resolve => {
    let settled = false;
    const finish = source => {
      if (settled) return;
      settled = true;
      sleepOverlay.removeEventListener("transitionend", onTransitionEnd);
      clearTimeout(fallback);
      debug("Fundido AMOLED terminado", { source });
      resolve();
    };
    const onTransitionEnd = event => {
      if (event.target === sleepOverlay && event.propertyName === "opacity") finish("transitionend");
    };
    const fallback = setTimeout(() => finish("fallback"), 850);
    sleepOverlay.addEventListener("transitionend", onTransitionEnd);
  });
}

function sleep(reason = "sin motivo") {
  clearSleepTimer();
  if (!settings.display?.fadeToBlackEnabled) {
    asleep = false;
    sleepOverlay.classList.remove("sleep-overlay--active");
    sleepOverlay.setAttribute("aria-hidden", "true");
    debug("Reposo AMOLED omitido por configuración", { reason });
    return;
  }

  asleep = true;
  sleepOverlay.classList.add("sleep-overlay--active");
  sleepOverlay.setAttribute("aria-hidden", "false");
  debug("Pantalla en reposo AMOLED", { reason });
}

async function closeTemporaryView(reason = "fin de vista temporal") {
  if (settings.display?.fadeToBlackEnabled) {
    sleep(reason);
    await waitForSleepFade();
    showDashboard("fundido AMOLED terminado");
  } else {
    showDashboard(reason);
    wake("vuelta al dashboard", dashboardAwakeDurationMs());
  }
}

function wake(reason = "sin motivo", duration = dashboardAwakeDurationMs()) {
  clearSleepTimer();
  asleep = false;
  sleepOverlay.classList.remove("sleep-overlay--active");
  sleepOverlay.setAttribute("aria-hidden", "true");
  debug("Despertando pantalla", { reason, duration });

  if (duration > 0) {
    sleepTimer = setTimeout(() => {
      showDashboard("fin de tiempo visible");
      sleep("inactividad");
    }, duration);
  }
}

function showDashboard(reason = "sin motivo") {
  clearTemporaryViewTimer();
  debug("Mostrando dashboard de notificaciones", { reason });
  views.show("notifications");
}

function showTemporaryView(id, reason = "evento temporal") {
  clearTemporaryViewTimer();
  clearSleepTimer();
  wake(reason, 0);

  const durationMs = temporaryDurationMs(id);
  debug("Abriendo vista temporal", { id, reason, durationMs });
  views.show(id);
  views.call(id, "startTimer", durationMs);
  temporaryViewId = id;

  temporaryViewTimer = setTimeout(() => {
    const closingId = temporaryViewId;
    debug("Temporizador de vista temporal finalizado", { id: closingId });
    if (closingId) views.call(closingId, "stopTimer");
    temporaryViewTimer = null;
    temporaryViewId = null;
    closeTemporaryView(`fin de ${closingId || "vista temporal"}`);
  }, durationMs);
}

views.register(createPlexView());
views.register(createGameView());
views.register(createNotificationsView({
  getLimit: getNotificationLimit,
  onSleep() {
    showDashboard("apagado manual");
    sleep("apagado manual");
  },
  onInteraction() {
    if (!asleep) wake("interacción en dashboard", dashboardAwakeDurationMs());
  }
}));
applySettings(settings);

function applyState(payload) {
  debug("Snapshot recibido", {
    activeView: payload?.activeView,
    playbackActive: payload?.playbackActive,
    plexTitle: payload?.plex?.title,
    gameTitle: payload?.game?.title,
    notificationCount: payload?.notifications?.total
  });

  if (payload?.settings) applySettings(payload.settings);
  views.update("plex-now-playing", payload?.plex);
  views.update("game-now-playing", payload?.game);
  views.update("notifications", payload?.notifications);

  if (!views.activeId) showDashboard("snapshot inicial");
}

const socket = new SocketClient({
  onMessage(message) {
    debug("Mensaje WebSocket recibido", message?.type, message?.payload);

    if (message.type === "state:snapshot") {
      applyState(message.payload);
      return;
    }

    if (message.type === "settings:update") {
      applySettings(message.payload);
      views.notify("notifications");
      return;
    }

    if (message.type === "custom-css:update") {
      refreshCustomCss();
      return;
    }

    if (message.type === "plex:update") {
      views.update("plex-now-playing", message.payload);
      return;
    }

    if (message.type === "game:update") {
      views.update("game-now-playing", message.payload);
      return;
    }

    if (message.type === "view:show") {
      const id = message.payload?.id || "notifications";
      debug("Orden de cambio de vista recibida", { id });
      if (id === "plex-now-playing" || id === "game-now-playing") {
        showTemporaryView(id, "orden view:show del servidor");
      } else {
        showDashboard("orden view:show del servidor");
        wake("orden dashboard del servidor", dashboardAwakeDurationMs());
      }
      return;
    }

    if (message.type === "notification:new") {
      views.notify("notifications", message.payload);
      showDashboard("nueva notificación");
      wake("nueva notificación", dashboardAwakeDurationMs());
      return;
    }

    debug("Mensaje WebSocket no gestionado", message);
  },
  onOpen() { debug("WebSocket conectado"); },
  onClose() { debug("WebSocket desconectado; se reintentará la conexión"); },
  onError(event) { debugError("Error de WebSocket", event); }
});

sleepOverlay.addEventListener("click", () => {
  if (!asleep || !settings.display?.wakeOnAnyTouch) return;
  showDashboard("toque para despertar");
  wake("toque en pantalla apagada", dashboardAwakeDurationMs());
});

window.addEventListener("error", event => {
  debugError("Error no controlado en frontend", { message: event.message, filename: event.filename, line: event.lineno });
});

showDashboard("arranque inicial");
sleep("arranque inicial");
socket.connect();
