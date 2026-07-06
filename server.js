import express from "express";
import { WebSocketServer } from "ws";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EventStore } from "./src/event-store.js";
import { RealtimeHub } from "./src/realtime-hub.js";
import { PlexService } from "./src/services/plex-service.js";
import { normalizeTautulliEvent } from "./src/adapters/tautulli.js";
import { normalizeArrEvent } from "./src/adapters/arr.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

const store = new EventStore(DATA_DIR);
await store.init();
const plex = new PlexService({ url: process.env.PLEX_URL, token: process.env.PLEX_TOKEN });

const runtime = {
  activeView: "notifications",
  plex: { event: "idle", title: "Esperando actividad", subtitle: "", year: "", posterUrl: null, backdropUrl: null, type: "" },
  playbackActive: false
};

function configStatus() {
  return {
    plexConfigured: plex.isConfigured(),
    plexUrlConfigured: Boolean(process.env.PLEX_URL),
    plexTokenConfigured: Boolean(process.env.PLEX_TOKEN),
    dataDir: DATA_DIR
  };
}

const server = app.listen(PORT, () => {
  const status = configStatus();
  console.log(`Kiosko Media Center escuchando en puerto ${PORT}`);
  console.log(`Plex configurado: ${status.plexConfigured ? "sí" : "NO"} (URL: ${status.plexUrlConfigured ? "sí" : "no"}, token: ${status.plexTokenConfigured ? "sí" : "no"})`);
  console.log(`Datos persistentes: ${status.dataDir}`);
  if (!status.plexConfigured) console.warn("ATENCIÓN: define PLEX_URL y PLEX_TOKEN en el archivo .env o en las variables de entorno del stack de Portainer.");
});
const wss = new WebSocketServer({ server });
const hub = new RealtimeHub(wss);

function snapshot() {
  return { type: "state:snapshot", payload: { activeView: runtime.activeView, playbackActive: runtime.playbackActive, plex: runtime.plex, notifications: store.list({ page: 1, limit: 5 }) } };
}
function broadcastState() { hub.broadcast(snapshot()); }
function publishActiveView() {
  console.log(`Vista activa solicitada: ${runtime.activeView}`);
  hub.broadcast({ type: "view:show", payload: { id: runtime.activeView } });
}
async function publishNotification(notification) {
  hub.broadcast({ type: "notification:new", payload: notification });
  broadcastState();
}
function chooseActiveView() {
  // El centro de notificaciones es siempre el dashboard principal, incluso vacío.
  runtime.activeView = runtime.playbackActive ? "plex-now-playing" : "notifications";
}

wss.on("connection", ws => {
  console.log("WebSocket conectado");
  hub.send(ws, snapshot());
});

app.get("/api/health", (_req, res) => res.json({ ok: true, ...configStatus(), notifications: store.list({ page: 1, limit: 1 }).total }));
app.get("/api/notifications", (req, res) => res.json(store.list(req.query)));

async function handleTautulliWebhook(req, res) {
  console.log("Webhook Tautulli recibido", {
    path: req.path,
    event: req.body?.event || req.body?.event_type || "desconocido",
    ratingKey: req.body?.ratingKey || req.body?.rating_key || null
  });

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

    // Sólo play/start abren el popup temporal de Plex.
    // Resume, pause y stop no lo abren; el dashboard sigue siendo la vista principal.
    if (event.startsPlayback) runtime.playbackActive = true;
    if (event.endsPlayback) runtime.playbackActive = false;

    if (event.isLibraryAdded) {
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
      chooseActiveView();
      await publishNotification(notification);
      publishActiveView();
    } else {
      chooseActiveView();
      console.log("Emitiendo plex:update y view:show", { activeView: runtime.activeView, title: runtime.plex.title });
      hub.broadcast({ type: "plex:update", payload: runtime.plex });
      publishActiveView();
      broadcastState();
    }

    res.status(200).json({ ok: true, event: event.event, rawEvent: event.rawEvent, activeView: runtime.activeView });
  } catch (error) {
    console.error("Error en webhook Tautulli:", error);
    res.status(500).json({ error: error.message });
  }
}

// Compatibilidad con la URL usada por el prototipo anterior.
app.post("/webhook", handleTautulliWebhook);
app.post("/webhook/tautulli", handleTautulliWebhook);

function detectArrSource(payload, routeSource = "") {
  const requested = String(routeSource || "").toLowerCase();
  if (["sonarr", "radarr"].includes(requested)) return requested;

  const eventType = String(payload?.eventType || payload?.event || payload?.type || "").toLowerCase();
  if (payload?.movie || eventType.includes("movie")) return "radarr";
  if (payload?.series || payload?.episode || Array.isArray(payload?.episodes) || eventType.includes("series")) return "sonarr";

  // En eventos Grab, la presencia de movie/series es la forma fiable de distinguirlos.
  return "";
}

async function handleArrWebhook(req, res) {
  const requestedSource = req.params?.source || "";
  const source = detectArrSource(req.body, requestedSource);
  const eventType = String(req.body?.eventType || req.body?.event || req.body?.type || "").trim();
  const compactEventType = eventType.toLowerCase().replace(/[\s_-]+/g, "");
  const sourceLabel = source || (requestedSource ? String(requestedSource).toLowerCase() : "arr");

  console.log(`Webhook ARR recibido (${sourceLabel})`, { eventType: eventType || "desconocido" });

  // Sonarr y Radarr envían este evento al pulsar "Test" en la conexión.
  // En la ruta común no hay datos suficientes para saber qué aplicación lo envió,
  // pero basta con responder 200 para validar la conexión.
  if (compactEventType === "test") {
    console.log(`Webhook ARR de prueba correcto (${sourceLabel}).`);
    return res.status(200).json({ ok: true, test: true, source: source || "arr", message: "Webhook ARR operativo" });
  }

  if (!source) {
    console.warn("Webhook ARR ignorado: no se pudo identificar Sonarr o Radarr.");
    return res.status(200).json({
      ok: true,
      ignored: true,
      reason: "No se pudo identificar el origen. Usa un payload nativo de Sonarr/Radarr."
    });
  }

  try {
    const normalized = normalizeArrEvent(req.body, source);
    console.log(`Evento ARR aceptado: ${source} · ${normalized.type} · ${normalized.title}`);
    const notification = await store.add(normalized);
    chooseActiveView();
    await publishNotification(notification);
    return res.status(200).json({ ok: true, id: notification.id, source });
  } catch (error) {
    // Los demás eventos se aceptan para que Arr no marque la conexión como fallida,
    // pero se ignoran porque no pertenecen al alcance actual.
    console.log(`Evento ARR ignorado (${source}): ${eventType || "sin eventType"}. ${error.message}`);
    return res.status(200).json({
      ok: true,
      ignored: true,
      reason: "Evento no configurado",
      source,
      supported: source === "radarr" ? ["Grab", "MovieAdded"] : ["Grab", "SeriesAdded"]
    });
  }
}

// Ruta unificada recomendada para Sonarr y Radarr.
app.post("/webhook/arr", handleArrWebhook);
// Rutas anteriores conservadas para compatibilidad.
app.post("/webhook/arr/:source", handleArrWebhook);

app.post("/api/notifications/test", async (req, res) => {
  const notification = await store.add({ source: "system", type: "test", title: req.body.title || "Notificación de prueba", subtitle: req.body.subtitle || "Centro de notificaciones activo" });
  chooseActiveView();
  await publishNotification(notification);
  res.status(201).json(notification);
});
