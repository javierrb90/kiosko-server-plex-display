import express from "express";
import { WebSocketServer } from "ws";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EventStore } from "./src/event-store.js";
import { RealtimeHub } from "./src/realtime-hub.js";
import { PlexService } from "./src/services/plex-service.js";
import { SettingsStore } from "./src/settings-store.js";
import { normalizeTautulliEvent } from "./src/adapters/tautulli.js";
import { normalizeArrEvent } from "./src/adapters/arr.js";
import { normalizePlayniteEvent } from "./src/adapters/playnite.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");

const settingsStore = new SettingsStore(DATA_DIR);
await settingsStore.init(process.env);
let settings = settingsStore.get();
const PORT = Number(settings.server?.port || process.env.PORT || 3000);

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use("/custom-css", express.static(settingsStore.customCssDir, { etag: false, maxAge: 0 }));
app.use(express.static(path.join(__dirname, "public")));

const store = new EventStore(DATA_DIR, { maxStored: settings.notifications.maxStored });
await store.init();
store.setMaxStored(settings.notifications.maxStored);

const plex = new PlexService(settings.plex);

const runtime = {
  activeView: "notifications",
  plex: { event: "idle", title: "Esperando actividad", subtitle: "", year: "", posterUrl: null, backdropUrl: null, type: "" },
  game: null,
  playbackActive: false
};

function currentSettings() {
  return settingsStore.get();
}

function refreshRuntimeSettings() {
  settings = currentSettings();
  plex.updateConfig(settings.plex);
  store.setMaxStored(settings.notifications.maxStored);
}

function configStatus() {
  refreshRuntimeSettings();
  return {
    plexConfigured: plex.isConfigured(),
    plexUrlConfigured: Boolean(settings.plex.url),
    plexTokenConfigured: Boolean(settings.plex.token),
    dataDir: DATA_DIR,
    settingsFile: settingsStore.filePath
  };
}

function notificationLimit() {
  return settings.views?.notifications?.itemsPerPage || 5;
}

function snapshot() {
  return {
    type: "state:snapshot",
    payload: {
      activeView: runtime.activeView,
      playbackActive: runtime.playbackActive,
      plex: runtime.plex,
      game: runtime.game,
      notifications: store.list({ page: 1, limit: notificationLimit() }),
      settings
    }
  };
}

function broadcastState() { hub.broadcast(snapshot()); }
function publishActiveView(id = runtime.activeView) {
  console.log(`Vista activa solicitada: ${id}`);
  hub.broadcast({ type: "view:show", payload: { id } });
}
async function publishNotification(notification) {
  hub.broadcast({ type: "notification:new", payload: notification });
  broadcastState();
}
function chooseActiveView() {
  runtime.activeView = runtime.playbackActive ? "plex-now-playing" : "notifications";
}

function compact(value) {
  return String(value || "").toLowerCase().trim().replace(/[\s_-]+/g, "");
}

function normalizedPlaybackTrigger(event) {
  const raw = compact(event.rawEvent);
  if (raw.includes("start")) return "start";
  if (event.event === "play") return "play";
  return event.event;
}

function arrEventEnabled(type) {
  const enabled = new Set((settings.integrations.arr.enabledEvents || []).map(compact));
  return enabled.has(compact(type));
}

const server = app.listen(PORT, () => {
  const status = configStatus();
  console.log(`Kiosko Media Center escuchando en puerto ${PORT}`);
  console.log(`Plex configurado: ${status.plexConfigured ? "sí" : "NO"} (URL: ${status.plexUrlConfigured ? "sí" : "no"}, token: ${status.plexTokenConfigured ? "sí" : "no"})`);
  console.log(`Datos persistentes: ${status.dataDir}`);
  console.log(`Configuración persistente: ${status.settingsFile}`);
  if (!status.plexConfigured) console.warn("ATENCIÓN: configura Plex desde /settings o rellena PLEX_URL y PLEX_TOKEN antes del primer arranque.");
});

const wss = new WebSocketServer({ server });
const hub = new RealtimeHub(wss);

wss.on("connection", ws => {
  console.log("WebSocket conectado");
  hub.send(ws, snapshot());
});

app.get("/api/health", (_req, res) => res.json({ ok: true, ...configStatus(), notifications: store.list({ page: 1, limit: 1 }).total }));
app.get("/api/notifications", (req, res) => res.json(store.list({ page: req.query.page, limit: req.query.limit || notificationLimit() })));

app.get("/api/settings", (_req, res) => {
  refreshRuntimeSettings();
  res.json(settings);
});

app.put("/api/settings", async (req, res) => {
  try {
    settings = await settingsStore.update(req.body || {});
    refreshRuntimeSettings();
    hub.broadcast({ type: "settings:update", payload: settings });
    broadcastState();
    res.json(settings);
  } catch (error) {
    console.error("Error guardando configuración:", error);
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.post("/api/settings/reset", async (_req, res) => {
  try {
    settings = await settingsStore.reset();
    refreshRuntimeSettings();
    hub.broadcast({ type: "settings:update", payload: settings });
    broadcastState();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/custom-css", async (_req, res) => {
  try {
    res.json(await settingsStore.listCustomCss());
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/custom-css/:file", async (req, res) => {
  try {
    res.type("text/css").send(await settingsStore.readCustomCss(req.params.file));
  } catch (error) {
    res.status(404).json({ ok: false, error: error.message });
  }
});

app.put("/api/custom-css/:file", async (req, res) => {
  try {
    const result = await settingsStore.writeCustomCss(req.params.file, req.body?.content || "");
    hub.broadcast({ type: "custom-css:update", payload: { file: result.filename } });
    res.json(result);
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

async function handleTautulliWebhook(req, res) {
  refreshRuntimeSettings();
  console.log("Webhook Tautulli recibido", {
    path: req.path,
    event: req.body?.event || req.body?.event_type || "desconocido",
    ratingKey: req.body?.ratingKey || req.body?.rating_key || null
  });

  if (!settings.integrations.tautulli.enabled) {
    console.log("Webhook Tautulli ignorado: integración desactivada.");
    return res.status(200).json({ ok: true, ignored: true, reason: "Tautulli desactivado" });
  }

  try {
    const ratingKey = req.body.ratingKey || req.body.rating_key;
    if (!ratingKey) {
      console.warn("Webhook Tautulli sin ratingKey. Campos recibidos:", Object.keys(req.body || {}));
      return res.status(400).json({ error: "Falta ratingKey.", receivedKeys: Object.keys(req.body || {}) });
    }

    const metadata = await plex.getMetadata(ratingKey);
    const event = normalizeTautulliEvent(req.body, metadata);

    runtime.plex = event.plex;
    console.log("Evento Tautulli normalizado", {
      rawEvent: event.rawEvent,
      event: event.event,
      startsPlayback: event.startsPlayback,
      endsPlayback: event.endsPlayback,
      isLibraryAdded: event.isLibraryAdded,
      title: runtime.plex.title
    });

    if (event.startsPlayback) runtime.playbackActive = true;
    if (event.endsPlayback) runtime.playbackActive = false;

    if (event.isLibraryAdded) {
      if (!settings.integrations.tautulli.notifyLibraryAdded) {
        console.log("Elemento añadido a Plex ignorado: notificaciones de biblioteca desactivadas.");
        runtime.activeView = "notifications";
        broadcastState();
        return res.status(200).json({ ok: true, ignored: true, reason: "notifyLibraryAdded desactivado" });
      }

      const notification = await store.add({
        source: "plex",
        type: "library_added",
        priority: "normal",
        title: `${metadata.title} añadido a Plex`,
        subtitle: metadata.subtitle || metadata.year,
        image: metadata.posterUrl,
        backdrop: metadata.backdropUrl,
        meta: { ratingKey: metadata.ratingKey, plexType: metadata.type }
      });
      runtime.activeView = "notifications";
      await publishNotification(notification);
      publishActiveView("notifications");
    } else {
      const trigger = normalizedPlaybackTrigger(event);
      const canShowPlex = settings.views.plex.enabled && event.startsPlayback && settings.integrations.tautulli.showPlaybackPopupOn.map(compact).includes(compact(trigger));
      chooseActiveView();
      console.log("Emitiendo plex:update", { canShowPlex, trigger, activeView: runtime.activeView, title: runtime.plex.title });
      hub.broadcast({ type: "plex:update", payload: runtime.plex });
      if (canShowPlex) publishActiveView("plex-now-playing");
      else broadcastState();
    }

    res.status(200).json({ ok: true, event: event.event, rawEvent: event.rawEvent, activeView: runtime.activeView });
  } catch (error) {
    console.error("Error en webhook Tautulli:", error);
    res.status(500).json({ error: error.message });
  }
}

app.post("/webhook", handleTautulliWebhook);
app.post("/webhook/tautulli", handleTautulliWebhook);

function detectArrSource(payload, routeSource = "") {
  const requested = String(routeSource || "").toLowerCase();
  if (["sonarr", "radarr"].includes(requested)) return requested;

  const eventType = String(payload?.eventType || payload?.event || payload?.type || "").toLowerCase();
  if (payload?.movie || eventType.includes("movie")) return "radarr";
  if (payload?.series || payload?.episode || Array.isArray(payload?.episodes) || eventType.includes("series")) return "sonarr";
  return "";
}

async function handleArrWebhook(req, res) {
  refreshRuntimeSettings();
  const requestedSource = req.params?.source || "";
  const source = detectArrSource(req.body, requestedSource);
  const eventType = String(req.body?.eventType || req.body?.event || req.body?.type || "").trim();
  const compactEventType = compact(eventType);
  const sourceLabel = source || (requestedSource ? String(requestedSource).toLowerCase() : "arr");

  console.log(`Webhook ARR recibido (${sourceLabel})`, { eventType: eventType || "desconocido" });

  if (!settings.integrations.arr.enabled) {
    console.log("Webhook ARR ignorado: integración desactivada.");
    return res.status(200).json({ ok: true, ignored: true, reason: "ARR desactivado" });
  }

  if (compactEventType === "test") {
    const testSource = source || "arr";
    const label = testSource === "sonarr" ? "Sonarr" : testSource === "radarr" ? "Radarr" : "ARR";
    console.log(`Webhook ARR de prueba correcto (${sourceLabel}).`);

    if (!settings.integrations.arr.storeTestNotifications) {
      return res.status(200).json({ ok: true, test: true, source: testSource, stored: false, message: "Webhook ARR operativo" });
    }

    const notification = await store.add({
      source: testSource,
      type: "test",
      priority: "low",
      title: `Prueba de webhook · ${label}`,
      subtitle: "Conexión verificada correctamente"
    });
    runtime.activeView = "notifications";
    await publishNotification(notification);
    return res.status(200).json({ ok: true, test: true, source: testSource, id: notification.id, message: "Webhook ARR operativo" });
  }

  if (!source) {
    console.warn("Webhook ARR ignorado: no se pudo identificar Sonarr o Radarr.");
    return res.status(200).json({ ok: true, ignored: true, reason: "No se pudo identificar el origen. Usa un payload nativo de Sonarr/Radarr." });
  }

  try {
    const normalized = normalizeArrEvent(req.body, source);
    if (!arrEventEnabled(normalized.type)) {
      console.log(`Evento ARR ignorado por configuración: ${source} · ${normalized.type}`);
      return res.status(200).json({ ok: true, ignored: true, reason: "Evento ARR desactivado", source, type: normalized.type });
    }

    console.log(`Evento ARR aceptado: ${source} · ${normalized.type} · ${normalized.title}`);
    const notification = await store.add(normalized);
    runtime.activeView = "notifications";
    await publishNotification(notification);
    return res.status(200).json({ ok: true, id: notification.id, source });
  } catch (error) {
    console.log(`Evento ARR ignorado (${source}): ${eventType || "sin eventType"}. ${error.message}`);
    return res.status(200).json({ ok: true, ignored: true, reason: "Evento no configurado", source, supported: source === "radarr" ? ["Grab", "MovieAdded"] : ["Grab", "SeriesAdded"] });
  }
}

async function handlePlayniteWebhook(req, res) {
  refreshRuntimeSettings();
  if (!settings.integrations.playnite.enabled) {
    console.log("Webhook Playnite ignorado: integración desactivada.");
    return res.status(200).json({ ok: true, ignored: true, reason: "Playnite desactivado" });
  }

  if (!settings.views.playnite.enabled) {
    console.log("Webhook Playnite recibido, pero la vista está desactivada.");
    return res.status(200).json({ ok: true, ignored: true, reason: "Vista Playnite desactivada" });
  }

  try {
    const game = normalizePlayniteEvent(req.body);
    runtime.game = game;
    runtime.activeView = "notifications";

    console.log("Webhook Playnite recibido", {
      title: game.title,
      platforms: game.platforms,
      hasCover: Boolean(game.cover),
      hasBackground: Boolean(game.background),
      payloadBytes: Number(req.headers["content-length"] || 0)
    });

    hub.broadcast({ type: "game:update", payload: game });
    console.log("Emitiendo game:update y view:show", { activeView: "game-now-playing", title: game.title });
    hub.broadcast({ type: "view:show", payload: { id: "game-now-playing" } });
    broadcastState();

    return res.status(200).json({ ok: true, event: game.event, title: game.title });
  } catch (error) {
    console.error("Error en webhook Playnite:", error);
    return res.status(400).json({ ok: false, error: error.message });
  }
}

app.post("/webhook/playnite", handlePlayniteWebhook);
app.post("/webhook/arr", handleArrWebhook);
app.post("/webhook/arr/:source", handleArrWebhook);

app.post("/api/notifications/test", async (req, res) => {
  refreshRuntimeSettings();
  const notification = await store.add({ source: "system", type: "test", title: req.body.title || "Notificación de prueba", subtitle: req.body.subtitle || "Centro de notificaciones activo" });
  runtime.activeView = "notifications";
  await publishNotification(notification);
  res.status(201).json(notification);
});
