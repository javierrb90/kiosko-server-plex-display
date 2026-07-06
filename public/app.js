import { ViewManager } from "/core/view-manager.js";
import { SocketClient } from "/core/socket-client.js";
import { createPlexView } from "/views/plex-now-playing.js";
import { createNotificationsView } from "/views/notifications.js";

const PLEX_POPUP_DURATION_MS = 5000;
// Tiempo visible del centro tras una notificación. Ajustable sin tocar el resto del flujo.
const DASHBOARD_AWAKE_DURATION_MS = 30000;
const DEBUG_PREFIX = "[Kiosko UI]";

const debug = (...args) => console.log(DEBUG_PREFIX, ...args);
const debugError = (...args) => console.error(DEBUG_PREFIX, ...args);

const views = new ViewManager(document.getElementById("app"), { debug });
let plexPopupTimer = null;

const sleepOverlay = document.getElementById("sleep-overlay");
let asleep = true;
let sleepTimer = null;

function clearSleepTimer() {
  clearTimeout(sleepTimer);
  sleepTimer = null;
}

function waitForSleepFade() {
  // En algunos navegadores Android antiguos transitionend puede no dispararse.
  // El fallback mantiene el flujo estable aunque ocurra eso.
  if (!sleepOverlay.classList.contains("sleep-overlay--active")) return Promise.resolve();

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
      if (event.target === sleepOverlay && event.propertyName === "opacity") {
        finish("transitionend");
      }
    };
    const fallback = setTimeout(() => finish("fallback"), 850);
    sleepOverlay.addEventListener("transitionend", onTransitionEnd);
  });
}

function sleep(reason = "sin motivo") {
  clearSleepTimer();
  asleep = true;
  sleepOverlay.classList.add("sleep-overlay--active");
  sleepOverlay.setAttribute("aria-hidden", "false");
  debug("Pantalla en reposo AMOLED", { reason });
}

async function closePlexToSleep(reason = "fin de reproducción temporal") {
  // Primero cubrimos Plex por completo. Sólo después cambiamos de vista,
  // evitando que el dashboard aparezca durante el fundido negro.
  sleep(reason);
  await waitForSleepFade();
  showDashboard("fundido AMOLED terminado");
}

function wake(reason = "sin motivo", duration = DASHBOARD_AWAKE_DURATION_MS) {
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
  clearTimeout(plexPopupTimer);
  plexPopupTimer = null;
  debug("Mostrando dashboard de notificaciones", { reason });
  views.show("notifications");
}

function showTemporaryPlex(reason = "evento de reproducción") {
  clearTimeout(plexPopupTimer);
  clearSleepTimer();
  wake(reason, 0);

  debug("Abriendo popup temporal de Plex", { reason, durationMs: PLEX_POPUP_DURATION_MS });
  views.show("plex-now-playing");
  views.call("plex-now-playing", "startTimer", PLEX_POPUP_DURATION_MS);

  plexPopupTimer = setTimeout(() => {
    debug("Temporizador de Plex finalizado; iniciando fundido AMOLED antes de volver al dashboard");
    views.call("plex-now-playing", "stopTimer");
    closePlexToSleep("fin de reproducción temporal");
  }, PLEX_POPUP_DURATION_MS);
}

views.register(createPlexView());
views.register(createNotificationsView({
  onSleep() {
    showDashboard("apagado manual");
    sleep("apagado manual");
  },
  onInteraction() {
    if (!asleep) wake("interacción en dashboard");
  }
}));

function applyState(payload) {
  debug("Snapshot recibido", {
    activeView: payload?.activeView,
    playbackActive: payload?.playbackActive,
    plexTitle: payload?.plex?.title,
    notificationCount: payload?.notifications?.total
  });

  views.update("plex-now-playing", payload?.plex);
  views.update("notifications", payload?.notifications);

  // Los snapshots sólo sincronizan contenido. Nunca despiertan el kiosko.
  if (!views.activeId) showDashboard("snapshot inicial");
}

const socket = new SocketClient({
  onMessage(message) {
    debug("Mensaje WebSocket recibido", message?.type, message?.payload);

    if (message.type === "state:snapshot") {
      applyState(message.payload);
      return;
    }

    if (message.type === "plex:update") {
      debug("Actualizando datos de Plex", message.payload);
      views.update("plex-now-playing", message.payload);
      return;
    }

    if (message.type === "view:show") {
      const id = message.payload?.id || "notifications";
      debug("Orden de cambio de vista recibida", { id });
      if (id === "plex-now-playing") showTemporaryPlex("orden view:show del servidor");
      else {
        showDashboard("orden view:show del servidor");
        wake("orden dashboard del servidor");
      }
      return;
    }

    if (message.type === "notification:new") {
      debug("Nueva notificación recibida", message.payload);
      views.notify("notifications", message.payload);
      showDashboard("nueva notificación");
      wake("nueva notificación");
      return;
    }

    debug("Mensaje WebSocket no gestionado", message);
  },
  onOpen() { debug("WebSocket conectado"); },
  onClose() { debug("WebSocket desconectado; se reintentará la conexión"); },
  onError(event) { debugError("Error de WebSocket", event); }
});

sleepOverlay.addEventListener("click", () => {
  if (!asleep) return;
  showDashboard("toque para despertar");
  wake("toque en pantalla apagada");
});

window.addEventListener("error", event => {
  debugError("Error no controlado en frontend", { message: event.message, filename: event.filename, line: event.lineno });
});

showDashboard("arranque inicial");
sleep("arranque inicial");
socket.connect();
