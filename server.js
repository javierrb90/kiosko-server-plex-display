import express from "express";
import { WebSocketServer } from "ws";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EventStore } from "./src/event-store.js";
import { RealtimeHub } from "./src/realtime-hub.js";
import { PlexService } from "./src/services/plex-service.js";
import { normalizeTautulliEvent } from "./src/adapters/tautulli.js";
import { normalizeArrEvent } from "./src/adapters/arr.js";
import { normalizePlayniteEvent } from "./src/adapters/playnite.js";
import { SettingsStore } from "./src/settings-store.js";
import { StateStore } from "./src/state-store.js";
import { AssetService } from "./src/asset-service.js";
import { WallpaperStore, CollectionStore } from "./src/library-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");

const settingsStore = new SettingsStore(DATA_DIR, process.env);
await settingsStore.init();
const settings = settingsStore.get();
const PORT = Number(process.env.PORT || settings.server?.port || 3000);

const app = express();
const maxPayloadMb = Number(settings.integrations?.playnite?.maxPayloadMb || 35);
app.use(express.json({ limit: `${maxPayloadMb}mb` }));
app.use(express.urlencoded({ extended: true, limit: `${maxPayloadMb}mb` }));
app.use("/assets", express.static(path.join(DATA_DIR, "assets"), { maxAge: "7d", immutable: false }));
app.use(express.static(path.join(__dirname, "public")));

const store = new EventStore(DATA_DIR);
const stateStore = new StateStore(DATA_DIR);
const assetService = new AssetService(DATA_DIR);
const wallpaperStore = new WallpaperStore(DATA_DIR);
const collectionStore = new CollectionStore(DATA_DIR);
await Promise.all([store.init(), stateStore.init(), assetService.init(), wallpaperStore.init(), collectionStore.init()]);

const plex = new PlexService(settingsStore.get().plex || {});

const runtime = {
  activeView: stateStore.get().activeView || "dashboard",
  plex: stateStore.get().lastPlex || { event: "idle", title: "Sin reproducción", subtitle: "", year: "", posterUrl: null, backdropUrl: null, type: "" },
  game: stateStore.get().lastGame || null
};

function configStatus() {
  const current = settingsStore.get();
  return {
    plexConfigured: plex.isConfigured(),
    plexUrlConfigured: Boolean(current.plex?.url),
    plexTokenConfigured: Boolean(current.plex?.token),
    dataDir: DATA_DIR,
    activeView: runtime.activeView
  };
}

const server = app.listen(PORT, () => {
  const status = configStatus();
  console.log(`Kiosko Media Center v4 escuchando en puerto ${PORT}`);
  console.log(`Plex configurado: ${status.plexConfigured ? "sí" : "NO"} (URL: ${status.plexUrlConfigured ? "sí" : "no"}, token: ${status.plexTokenConfigured ? "sí" : "no"})`);
  console.log(`Datos persistentes: ${status.dataDir}`);
});
const wss = new WebSocketServer({ server });
const hub = new RealtimeHub(wss);

function listNotifications(limit) {
  const configuredLimit = settingsStore.get().views?.notifications?.itemsPerPage || 5;
  return store.list({ page: 1, limit: limit || configuredLimit });
}

function snapshot() {
  return {
    type: "state:snapshot",
    payload: {
      activeView: runtime.activeView,
      plex: runtime.plex,
      game: runtime.game,
      notifications: listNotifications(),
      settings: publicSettings(),
      wallpapers: wallpaperStore.list(),
      collections: collectionStore.list(),
      state: stateStore.get()
    }
  };
}
function broadcastState() { hub.broadcast(snapshot()); }
function publicSettings() { return settingsStore.get(); }
async function navigate(viewId, reason = "manual") {
  runtime.activeView = viewId;
  await stateStore.update({ activeView: viewId });
  console.log(`Navegando a vista: ${viewId}`, { reason });
  hub.broadcast({ type: "view:show", payload: { id: viewId, reason } });
}
async function publishNotification(notification, { navigateToNotifications = false } = {}) {
  hub.broadcast({ type: "notification:new", payload: notification });
  if (navigateToNotifications) await navigate("notifications", "notificación");
  broadcastState();
}
function normalizeEnabledPlaybackEvent(event = "") {
  return String(event || "").toLowerCase().trim().replace(/[\s_-]+/g, "");
}
function shouldShowPlexEvent(event) {
  const allowed = settingsStore.get().integrations?.tautulli?.showPlaybackOn || ["play", "start"];
  const key = normalizeEnabledPlaybackEvent(event);
  return allowed.some(item => normalizeEnabledPlaybackEvent(item) === key);
}

wss.on("connection", ws => {
  console.log("WebSocket conectado");
  hub.send(ws, snapshot());
});

app.get("/api/health", (_req, res) => res.json({ ok: true, ...configStatus(), notifications: store.list({ page: 1, limit: 1 }).total, wallpapers: wallpaperStore.list().length, collections: collectionStore.list().length }));
app.get("/api/state", (_req, res) => res.json(stateStore.get()));
app.put("/api/state", async (req, res) => { const state = await stateStore.update(req.body || {}); broadcastState(); res.json(state); });

app.get("/api/settings", (_req, res) => res.json(publicSettings()));
app.put("/api/settings", async (req, res) => {
  const next = await settingsStore.update(req.body || {});
  plex.setConfig(next.plex || {});
  hub.broadcast({ type: "settings:update", payload: next });
  broadcastState();
  res.json(next);
});
app.post("/api/settings/reset", async (_req, res) => {
  const next = await settingsStore.reset();
  plex.setConfig(next.plex || {});
  hub.broadcast({ type: "settings:update", payload: next });
  broadcastState();
  res.json(next);
});

app.get("/api/custom-css/:name", async (req, res) => {
  const safe = String(req.params.name || "global").replace(/[^a-z0-9_-]/gi, "");
  const file = path.join(DATA_DIR, "custom-css", `${safe}.css`);
  try { res.type("text/css").send(await (await import("node:fs/promises")).readFile(file, "utf8")); }
  catch { res.type("text/css").send(""); }
});
app.put("/api/custom-css/:name", express.text({ type: "text/css", limit: "1mb" }), async (req, res) => {
  const fs = await import("node:fs/promises");
  const safe = String(req.params.name || "global").replace(/[^a-z0-9_-]/gi, "");
  const dir = path.join(DATA_DIR, "custom-css");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${safe}.css`), String(req.body || ""), "utf8");
  hub.broadcast({ type: "custom-css:update", payload: { name: safe } });
  res.json({ ok: true, name: safe });
});

app.get("/api/notifications", (req, res) => res.json(store.list(req.query)));
app.post("/api/notifications/test", async (req, res) => {
  const notification = await store.add({ source: "system", type: "test", priority: "low", title: req.body?.title || "Prueba", subtitle: req.body?.subtitle || "Notificación de prueba" });
  await publishNotification(notification);
  res.json(notification);
});

app.get("/api/wallpapers", (_req, res) => res.json(wallpaperStore.list()));
app.post("/api/wallpapers", async (req, res) => {
  try {
    const asset = await assetService.saveImage(req.body?.image || req.body?.url || req.body?.dataUri, { bucket: "wallpapers", title: req.body?.title || "wallpaper" });
    const wallpaper = await wallpaperStore.add({ title: req.body?.title || "Wallpaper", source: req.body?.source || "manual", status: req.body?.status || "active", asset, meta: req.body?.meta || {} });
    hub.broadcast({ type: "wallpapers:update", payload: wallpaperStore.list() });
    broadcastState();
    res.status(201).json(wallpaper);
  } catch (error) { res.status(400).json({ error: error.message }); }
});
app.patch("/api/wallpapers/:id", async (req, res) => {
  try { const item = await wallpaperStore.update(req.params.id, req.body || {}); hub.broadcast({ type: "wallpapers:update", payload: wallpaperStore.list() }); res.json(item); }
  catch (error) { res.status(404).json({ error: error.message }); }
});
app.delete("/api/wallpapers/:id", async (req, res) => {
  try { const removed = await wallpaperStore.remove(req.params.id); await assetService.removePublicPath(removed.assetPath); hub.broadcast({ type: "wallpapers:update", payload: wallpaperStore.list() }); broadcastState(); res.json({ ok: true }); }
  catch (error) { res.status(404).json({ error: error.message }); }
});

app.get("/api/collections", (_req, res) => res.json(collectionStore.list()));
app.post("/api/collections", async (req, res) => {
  const c = await collectionStore.create({ name: req.body?.name || "Nueva colección" });
  hub.broadcast({ type: "collections:update", payload: collectionStore.list() });
  res.status(201).json(c);
});
app.patch("/api/collections/:id", async (req, res) => {
  try { const c = await collectionStore.update(req.params.id, req.body || {}); hub.broadcast({ type: "collections:update", payload: collectionStore.list() }); res.json(c); }
  catch (error) { res.status(404).json({ error: error.message }); }
});
app.delete("/api/collections/:id", async (req, res) => {
  try { const removed = await collectionStore.remove(req.params.id); for (const item of removed.items || []) await assetService.removePublicPath(item.assetPath); hub.broadcast({ type: "collections:update", payload: collectionStore.list() }); broadcastState(); res.json({ ok: true }); }
  catch (error) { res.status(404).json({ error: error.message }); }
});
app.post("/api/collections/:id/items", async (req, res) => {
  try {
    const asset = await assetService.saveImage(req.body?.image || req.body?.url || req.body?.dataUri, { bucket: "collections", title: req.body?.title || "item" });
    const item = await collectionStore.addItem(req.params.id, { title: req.body?.title || "Imagen", source: req.body?.source || "manual", asset, meta: req.body?.meta || {} });
    hub.broadcast({ type: "collections:update", payload: collectionStore.list() });
    broadcastState();
    res.status(201).json(item);
  } catch (error) { res.status(400).json({ error: error.message }); }
});
app.delete("/api/collections/:id/items/:itemId", async (req, res) => {
  try { const removed = await collectionStore.removeItem(req.params.id, req.params.itemId); await assetService.removePublicPath(removed.assetPath); hub.broadcast({ type: "collections:update", payload: collectionStore.list() }); res.json({ ok: true }); }
  catch (error) { res.status(404).json({ error: error.message }); }
});
app.post("/api/collections/:id/items/:itemId/move", async (req, res) => {
  try { const c = await collectionStore.moveItem(req.params.id, req.params.itemId, req.body?.direction || "up"); hub.broadcast({ type: "collections:update", payload: collectionStore.list() }); res.json(c); }
  catch (error) { res.status(404).json({ error: error.message }); }
});

async function handleTautulliWebhook(req, res) {
  console.log("Webhook Tautulli recibido", { path: req.path, event: req.body?.event || req.body?.event_type || "desconocido", ratingKey: req.body?.ratingKey || req.body?.rating_key || null });
  if (!settingsStore.get().integrations?.tautulli?.enabled) return res.status(200).json({ ok: true, ignored: true, reason: "Tautulli desactivado" });
  try {
    const ratingKey = req.body.ratingKey || req.body.rating_key;
    if (!ratingKey) return res.status(400).json({ error: "Falta ratingKey.", receivedKeys: Object.keys(req.body || {}) });
    const metadata = await plex.getMetadata(ratingKey);
    const event = normalizeTautulliEvent(req.body, metadata);
    runtime.plex = event.plex;
    await stateStore.update({ lastPlex: runtime.plex });
    hub.broadcast({ type: "plex:update", payload: runtime.plex });

    if (event.startsPlayback && shouldShowPlexEvent(event.event)) {
      await navigate("plex-now-playing", "plex playback");
    }

    if (event.isLibraryAdded && settingsStore.get().integrations?.tautulli?.notifyLibraryAdded) {
      const notification = await store.add({ source: "plex", type: "library_added", priority: "normal", title: `${metadata.title} añadido a Plex`, subtitle: metadata.subtitle || metadata.year, image: metadata.posterUrl, backdrop: metadata.backdropUrl, meta: { ratingKey: metadata.ratingKey, plexType: metadata.type } });
      await publishNotification(notification);
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
  if (!settingsStore.get().integrations?.arr?.enabled) return res.status(200).json({ ok: true, ignored: true, reason: "Arr desactivado" });
  const requestedSource = req.params?.source || "";
  const source = detectArrSource(req.body, requestedSource);
  const eventType = String(req.body?.eventType || req.body?.event || req.body?.type || "").trim();
  const compactEventType = eventType.toLowerCase().replace(/[\s_-]+/g, "");
  const sourceLabel = source || (requestedSource ? String(requestedSource).toLowerCase() : "arr");
  console.log(`Webhook ARR recibido (${sourceLabel})`, { eventType: eventType || "desconocido" });
  if (compactEventType === "test") {
    if (!settingsStore.get().integrations?.arr?.storeTestNotifications) return res.status(200).json({ ok: true, test: true });
    const label = source === "sonarr" ? "Sonarr" : source === "radarr" ? "Radarr" : "ARR";
    const notification = await store.add({ source: source || "arr", type: "test", priority: "low", title: `Prueba de webhook · ${label}`, subtitle: "Conexión verificada correctamente" });
    await publishNotification(notification);
    return res.status(200).json({ ok: true, test: true, id: notification.id });
  }
  if (!source) return res.status(200).json({ ok: true, ignored: true, reason: "No se pudo identificar el origen." });
  try {
    const normalized = normalizeArrEvent(req.body, source);
    const notification = await store.add(normalized);
    await publishNotification(notification);
    return res.status(200).json({ ok: true, id: notification.id, source });
  } catch (error) {
    console.log(`Evento ARR ignorado (${source}): ${eventType || "sin eventType"}. ${error.message}`);
    return res.status(200).json({ ok: true, ignored: true, reason: "Evento no configurado", source });
  }
}
app.post("/webhook/arr", handleArrWebhook);
app.post("/webhook/arr/:source", handleArrWebhook);

async function persistPlayniteRuntimeAssets(game = {}) {
  const normalized = { ...game };
  const title = normalized.title || "playnite";

  // Playnite envía imágenes como Data URI grandes. Para Wallpaper Engine es mejor
  // no conservar ni reenviar Base64 al frontend: se guardan una vez en disco y
  // desde ese momento la UI trabaja sólo con rutas locales /assets/....
  if (normalized.cover && String(normalized.cover).startsWith("data:image/")) {
    const coverAsset = await assetService.saveImage(normalized.cover, { bucket: "playnite", title: `${title}-cover` });
    normalized.cover = coverAsset.path;
    normalized.coverAssetPath = coverAsset.path;
  }

  if (normalized.background && String(normalized.background).startsWith("data:image/")) {
    const bgAsset = await assetService.saveImage(normalized.background, { bucket: "playnite", title: `${title}-background` });
    normalized.background = bgAsset.path;
    normalized.backgroundAssetPath = bgAsset.path;
  }

  return normalized;
}

async function handlePlayniteWebhook(req, res) {
  if (!settingsStore.get().integrations?.playnite?.enabled) return res.status(200).json({ ok: true, ignored: true, reason: "Playnite desactivado" });
  try {
    const rawGame = normalizePlayniteEvent(req.body);
    const game = await persistPlayniteRuntimeAssets(rawGame);
    runtime.game = game;
    await stateStore.update({ lastGame: runtime.game });
    console.log("Webhook Playnite recibido", { title: game.title, platforms: game.platforms, hasCover: Boolean(game.cover), hasBackground: Boolean(game.background), payloadBytes: Number(req.headers["content-length"] || 0), persistedAssets: true });
    hub.broadcast({ type: "game:update", payload: game });
    await navigate("game-now-playing", "playnite game_started");
    return res.status(200).json({ ok: true, event: game.event, title: game.title });
  } catch (error) {
    console.error("Error en webhook Playnite:", error);
    return res.status(400).json({ ok: false, error: error.message });
  }
}
app.post("/webhook/playnite", handlePlayniteWebhook);
