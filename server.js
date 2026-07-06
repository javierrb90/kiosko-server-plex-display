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
  activeView: "idle",
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
  return { type: "state:snapshot", payload: { activeView: runtime.activeView, plex: runtime.plex, notifications: store.list({ page: 1, limit: 5 }) } };
}
function broadcastState() { hub.broadcast(snapshot()); }
async function publishNotification(notification) {
  hub.broadcast({ type: "notification:new", payload: notification });
  broadcastState();
}
function chooseActiveView() {
  runtime.activeView = runtime.playbackActive ? "plex-now-playing" : (store.list({ page: 1, limit: 1 }).total ? "notifications" : "idle");
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
    if (event.isPlayback) runtime.playbackActive = event.event !== "stop";

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
    } else {
      chooseActiveView();
      broadcastState();
    }

    res.status(200).json({ ok: true, event: event.event, activeView: runtime.activeView });
  } catch (error) {
    console.error("Error en webhook Tautulli:", error);
    res.status(500).json({ error: error.message });
  }
}

// Compatibilidad con la URL usada por el prototipo anterior.
app.post("/webhook", handleTautulliWebhook);
app.post("/webhook/tautulli", handleTautulliWebhook);

app.post("/webhook/arr/:source", async (req, res) => {
  const source = String(req.params.source || "arr").toLowerCase();
  console.log(`Webhook ARR recibido (${source})`);
  try {
    if (!["sonarr", "radarr", "arr"].includes(source)) return res.status(400).json({ error: "Source no soportado." });
    const normalized = normalizeArrEvent(req.body, source);
    const notification = await store.add(normalized);
    chooseActiveView();
    await publishNotification(notification);
    res.status(200).json({ ok: true, id: notification.id });
  } catch (error) {
    console.error("Error en webhook ARR:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/notifications/test", async (req, res) => {
  const notification = await store.add({ source: "system", type: "test", title: req.body.title || "Notificación de prueba", subtitle: req.body.subtitle || "Centro de notificaciones activo" });
  chooseActiveView();
  await publishNotification(notification);
  res.status(201).json(notification);
});
