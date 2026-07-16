import express from "express";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import { WebSocketServer } from "ws";
import path from "node:path";
import os from "node:os";
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
import { BacklogStore, CompletionStore } from "./src/backlog-store.js";
import { CollectionGroupStore } from "./src/collection-group-store.js";
import { OnDeckStore } from "./src/on-deck-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");

const settingsStore = new SettingsStore(DATA_DIR, process.env);
await settingsStore.init();
const settings = settingsStore.get();
const PORT = Number(process.env.PORT || settings.server?.port || 3000);

const app = express();
const maxPayloadMb = Math.max(Number(settings.integrations?.playnite?.maxPayloadMb || 80), 80);

function getLocalAddresses() {
  const nets = os.networkInterfaces();
  const addresses = [];
  for (const [name, entries] of Object.entries(nets)) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) {
        addresses.push({ name, address: entry.address });
      }
    }
  }
  return addresses;
}

function isProbablyDocker() {
  return fsSync.existsSync("/.dockerenv") || String(process.env.DATA_DIR || "").startsWith("/app/");
}

function printStartupDiagnostics(port, host = "0.0.0.0") {
  const addresses = getLocalAddresses();
  const firstLan = addresses[0]?.address;
  console.log(`Kiosko Media Center v5.9.11 escuchando en ${host}:${port}`);
  console.log(`Datos persistentes: ${DATA_DIR}`);
  if (firstLan) console.log(`Acceso local sugerido: http://${firstLan}:${port}`);
  console.log(`Diagnóstico: /api/health · /api/diagnostics`);
}

app.use(express.json({ limit: `${maxPayloadMb}mb` }));


const slowApiThresholdMs = Number(process.env.SLOW_API_LOG_MS || 750);
app.use((req, res, next) => {
  const started = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - started;
    const noisy = req.path.startsWith("/assets/") || req.path === "/favicon.ico";
    if (process.env.DEBUG_HTTP === "1" && !noisy) console.log(`[http] ${req.method} ${req.originalUrl} -> ${res.statusCode} ${ms}ms from ${req.ip || req.socket?.remoteAddress || "unknown"}`);
    else if (req.path.startsWith("/api/") && ms > slowApiThresholdMs) console.warn(`[slow-api] ${req.method} ${req.originalUrl} -> ${res.statusCode} ${ms}ms`);
  });
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    app: "Kiosko Media Center",
    pid: process.pid,
    uptimeSeconds: Math.round(process.uptime()),
    dataDir: DATA_DIR,
    port: PORT,
    time: new Date().toISOString()
  });
});

app.get("/api/diagnostics", (_req, res) => {
  const addresses = getLocalAddresses();
  res.json({
    ok: true,
    pid: process.pid,
    cwd: process.cwd(),
    node: process.version,
    env: process.env.NODE_ENV || null,
    port: PORT,
    dataDir: DATA_DIR,
    dockerLikely: isProbablyDocker(),
    interfaces: addresses,
    suggestedUrls: [`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`, ...addresses.map(entry => `http://${entry.address}:${PORT}`)],
    uptimeSeconds: Math.round(process.uptime()),
    time: new Date().toISOString()
  });
});

app.use(express.urlencoded({ extended: true, limit: `${maxPayloadMb}mb` }));
app.use("/assets", express.static(path.join(DATA_DIR, "assets"), { maxAge: "7d", immutable: false }));
app.use(express.static(path.join(__dirname, "public")));

const store = new EventStore(DATA_DIR);
const stateStore = new StateStore(DATA_DIR);
const assetService = new AssetService(DATA_DIR);
const backlogStore = new BacklogStore(DATA_DIR);
const completionStore = new CompletionStore(DATA_DIR);
const collectionGroupStore = new CollectionGroupStore(DATA_DIR);
const onDeckStore = new OnDeckStore(DATA_DIR);
await Promise.all([store.init(), stateStore.init(), assetService.init(), backlogStore.init(), completionStore.init(), collectionGroupStore.init(), onDeckStore.init()]);

const plex = new PlexService(settingsStore.get().plex || {});

const validViews = new Set(["backlog", "on-deck", "current-content", "collections"]);
const initialActiveView = validViews.has(stateStore.get().activeView)
  ? stateStore.get().activeView
  : (validViews.has(settingsStore.get().display?.defaultView) ? settingsStore.get().display.defaultView : "backlog");

const runtime = {
  activeView: initialActiveView,
  plex: stateStore.get().lastPlex || { event: "idle", title: "Sin reproducción", subtitle: "", year: "", posterUrl: null, backdropUrl: null, type: "" },
  game: stateStore.get().lastGame || null,
  currentContent: stateStore.get().lastCurrent || null
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

const server = app.listen(PORT, "0.0.0.0", () => {
  const status = configStatus();
  console.log(`Kiosko Media Center v5.9.11 escuchando en puerto ${PORT}`);
  console.log(`Plex configurado: ${status.plexConfigured ? "sí" : "NO"} (URL: ${status.plexUrlConfigured ? "sí" : "no"}, token: ${status.plexTokenConfigured ? "sí" : "no"})`);
  console.log(`Datos persistentes: ${status.dataDir}`);
  printStartupDiagnostics(PORT, "0.0.0.0");
});
const wss = new WebSocketServer({ server });
const hub = new RealtimeHub(wss);

function listNotifications(limit) {
  const configuredLimit = settingsStore.get().views?.notifications?.itemsPerPage || 50;
  return store.list({ page: 1, limit: limit || configuredLimit });
}

function unreadNotificationCount() {
  return store.countSince(stateStore.get().lastNotificationsViewedAt);
}


function cleanPublicValue(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 40).map(entry => cleanPublicValue(entry, depth + 1)).filter(entry => entry !== undefined);
  if (typeof value === "object") {
    if (depth > 2) return value.name || value.title || value.tag || value.label || value.value || undefined;
    const output = {};
    for (const [key, entry] of Object.entries(value)) {
      if (["raw", "Raw", "payload", "response", "metadata", "Media", "Image"].includes(key)) continue;
      const cleaned = cleanPublicValue(entry, depth + 1);
      if (cleaned !== undefined) output[key] = cleaned;
    }
    return output;
  }
  return undefined;
}

function publicItem(item = {}) {
  if (!item || typeof item !== "object") return item;
  const meta = cleanPublicValue(item.meta || {}) || {};
  delete meta.raw;
  return { ...item, meta };
}

function publicBacklog() {
  const data = backlogStore.list();
  return { plex: (data.plex || []).map(publicItem), playnite: (data.playnite || []).map(publicItem) };
}

function publicOnDeck() {
  return onDeckStore.list().map(publicItem);
}

function publicCompletions() {
  return completionStore.list().map(publicItem);
}

function snapshot() {
  return {
    type: "state:snapshot",
    payload: {
      activeView: runtime.activeView,
      currentContent: runtime.currentContent,
      plex: runtime.plex,
      game: runtime.game,
      notifications: listNotifications(),
      unreadCount: unreadNotificationCount(),
      settings: publicSettings(),
      backlog: publicBacklog(),
      onDeck: publicOnDeck(),
      onDeckMap: onDeckStore.map(),
      completions: publicCompletions(),
    collectionGroups: collectionGroupStore.list(),
      completionRatings: completionStore.ratingsMap(),
      state: stateStore.get()
    }
  };
}
function broadcastState() { /* v5.6.14: snapshots are HTTP-only; WebSocket sends specific events. */ }
function publicSettings() { return settingsStore.get(); }
async function buildExportPayload() {
  let customCss = "";
  try {
    customCss = await fs.readFile(path.join(DATA_DIR, "custom-css", "global.css"), "utf8");
  } catch {}
  return {
    exportedAt: new Date().toISOString(),
    app: "kiosko-media-center",
    version: "v5.5",
    settings: publicSettings(),
    state: stateStore.get(),
    backlog: backlogStore.list(),
    onDeck: onDeckStore.list(),
    completions: completionStore.list(),
    collectionGroups: collectionGroupStore.list(),
    notifications: store.list({ page: 1, limit: 50 }).items,
    customCss
  };
}
async function navigate(viewId, reason = "manual", { force = false } = {}) {
  const locked = Boolean(stateStore.get().privacyLocked);
  if (locked && !force) {
    console.log(`Navegación bloqueada por privacidad: ${viewId}`, { reason });
    return false;
  }
  runtime.activeView = viewId;
  await stateStore.update({ activeView: viewId });
  console.log(`Navegación local registrada: ${viewId}`, { reason });
  return true;
}
async function publishNotification(notification, { navigateToNotifications = false } = {}) {
  hub.broadcast({ type: "notification:new", payload: notification });
  if (navigateToNotifications) hub.broadcast({ type: "notifications:open", payload: { reason: "notificación" } });
}
function normalizeEnabledPlaybackEvent(event = "") {
  return String(event || "").toLowerCase().trim().replace(/[\s_-]+/g, "");
}
function shouldShowPlexEvent(event) {
  const allowed = settingsStore.get().integrations?.tautulli?.showPlaybackOn || ["play", "start"];
  const key = normalizeEnabledPlaybackEvent(event);
  return allowed.some(item => normalizeEnabledPlaybackEvent(item) === key);
}
function backlogSources() {
  const sources = settingsStore.get().backlog?.sources || {};
  return {
    plexRecentlyAdded: sources.plexRecentlyAdded !== false,
    plexPlayback: sources.plexPlayback === true,
    playniteStarted: sources.playniteStarted !== false
  };
}

wss.on("connection", ws => {
  console.log("WebSocket conectado");
  hub.send(ws, { type: "socket:ready", payload: { ok: true } });
});

app.get("/api/health", (_req, res) => res.json({ ok: true, ...configStatus(), notifications: store.list({ page: 1, limit: 1 }).total, backlog: backlogStore.source("plex").length + backlogStore.source("playnite").length, onDeck: onDeckStore.list().length, completions: completionStore.list().length }));
app.get("/api/snapshot", (_req, res) => res.json(snapshot().payload));
app.get("/api/state", (_req, res) => res.json(stateStore.get()));
app.put("/api/state", async (req, res) => {
  const patch = req.body || {};
  const state = await stateStore.update(patch);
  if (patch.activeView && validViews.has(patch.activeView)) runtime.activeView = patch.activeView;
  if (patch.privacyLocked === true) {
    runtime.activeView = "backlog";
    await stateStore.update({ activeView: "backlog" });
    hub.broadcast({ type: "privacy:update", payload: { privacyLocked: true } });
  }
  res.json(stateStore.get());
});

app.get("/api/settings", (_req, res) => res.json(publicSettings()));
app.put("/api/settings", async (req, res) => {
  const next = await settingsStore.update(req.body || {});
  plex.setConfig(next.plex || {});
  hub.broadcast({ type: "settings:update", payload: next });
  res.json(next);
});
app.post("/api/settings/reset", async (_req, res) => {
  const next = await settingsStore.reset();
  plex.setConfig(next.plex || {});
  hub.broadcast({ type: "settings:update", payload: next });
  res.json(next);
});
app.get("/api/export", async (_req, res) => {
  const payload = await buildExportPayload();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=\"kiosko-backup-${stamp}.json\"`);
  res.send(JSON.stringify(payload, null, 2));
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

app.get("/api/notifications", (req, res) => res.json(store.list({ ...req.query, limit: req.query.limit || 50 })));
app.delete("/api/notifications", async (_req, res) => {
  await store.clear();
  hub.broadcast({ type: "notifications:cleared", payload: { ok: true } });
  res.json({ ok: true });
});

function getExternalIdFromRequest(req) {
  if (Object.prototype.hasOwnProperty.call(req.body || {}, "externalId")) return req.body.externalId;
  return req.get("Idempotency-Key") || null;
}

function validateExternalId(externalId) {
  if (externalId === null || externalId === undefined || externalId === "") return null;
  if (typeof externalId !== "string" || externalId.trim().length === 0 || externalId.length > 255) {
    return "externalId must be a non-empty string with a maximum length of 255 characters";
  }
  return null;
}

function normalizeExternalNotificationPayload(body = {}, externalId = null) {
  const title = body.title || body.summary || body.message || body.text || "Nueva notificación";
  const subtitle = body.subtitle || body.detail || body.description || (body.title ? body.message : "") || "";
  const allowedPriorities = new Set(["low", "normal", "high"]);
  const priority = allowedPriorities.has(body.priority) ? body.priority : "normal";
  const meta = body.meta && typeof body.meta === "object" && !Array.isArray(body.meta) ? { ...body.meta } : {};
  if (externalId && !meta.externalId) meta.externalId = externalId;
  if (body.id && !meta.id) meta.id = body.id;
  if (body.url && !meta.url) meta.url = body.url;

  return {
    source: body.source || "external",
    type: body.type || "info",
    priority,
    title,
    subtitle,
    image: body.image || body.icon || null,
    backdrop: body.backdrop || null,
    url: body.url || null,
    meta
  };
}

async function handleExternalNotification(req, res) {
  try {
    const externalId = getExternalIdFromRequest(req);
    const validationError = validateExternalId(externalId);
    if (validationError) return res.status(400).json({ ok: false, error: validationError });

    const input = normalizeExternalNotificationPayload(req.body || {}, externalId);
    const result = await store.addExternal(input, externalId || null);

    if (result.duplicate) {
      return res.status(200).json({ ok: true, duplicate: true, notification: result.notification });
    }

    await publishNotification(result.notification);
    return res.status(201).json({ ok: true, duplicate: false, notification: result.notification });
  } catch (error) {
    console.error("Error creando notificación externa:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}

app.post("/api/notifications", handleExternalNotification);
app.post("/api/notify", handleExternalNotification);
app.post("/api/notifications/test", async (req, res) => {
  const notification = await store.add({ source: "system", type: "test", priority: "low", title: req.body?.title || "Prueba", subtitle: req.body?.subtitle || "Notificación de prueba" });
  await publishNotification(notification);
  res.json(notification);
});

app.post("/api/simulate/:kind", async (req, res) => {
  const kind = String(req.params.kind || "notification");
  try {
    if (kind === "plex") {
      runtime.plex = {
        event: "play",
        title: req.body?.title || "Película de prueba",
        subtitle: req.body?.subtitle || "Simulación Plex",
        year: req.body?.year || "2026",
        posterUrl: req.body?.posterUrl || null,
        backdropUrl: req.body?.backdropUrl || null,
        type: "movie",
        ratingKey: "simulated"
      };
      runtime.currentContent = { ...runtime.plex, source: "plex", kind: "plex" };
      await stateStore.update({ lastPlex: runtime.plex, lastCurrent: runtime.currentContent });
      if (backlogSources().plexPlayback) {
        await backlogStore.upsert("plex", normalizePlexBacklogItem(runtime.plex));
        broadcastBacklogAndCompletions();
      }
      hub.broadcast({ type: "current:update", payload: runtime.currentContent });
      return res.json({ ok: true, kind, view: runtime.activeView });
    }
    if (kind === "game") {
      runtime.game = {
        event: "game_started",
        title: req.body?.title || "Juego de prueba",
        platforms: ["PC"],
        developers: ["Playnite Simulator"],
        publishers: [],
        genres: ["Test"],
        releaseYear: "2026",
        cover: null,
        background: null
      };
      runtime.currentContent = { ...runtime.game, source: "playnite", kind: "game" };
      await stateStore.update({ lastGame: runtime.game, lastCurrent: runtime.currentContent });
      const playniteItem = normalizePlayniteBacklogItem(runtime.game);
      const deckUpdated = await updateOnDeckActivityFromItem({ ...runtime.game, source: "playnite" });
      if (!deckUpdated && !isGameInDeckOrCompleted(playniteItem) && backlogSources().playniteStarted) {
        await backlogStore.upsert("playnite", playniteItem);
        broadcastBacklogAndCompletions();
      }
      hub.broadcast({ type: "current:update", payload: runtime.currentContent });
      return res.json({ ok: true, kind, view: runtime.activeView });
    }

    const samples = {
      grab: { source: "radarr", type: "grab", title: "Descarga iniciada", subtitle: "Release de prueba capturado" },
      movie: { source: "radarr", type: "movie_added", title: "Película monitorizada", subtitle: "Radarr · simulación" },
      series: { source: "sonarr", type: "series_added", title: "Serie monitorizada", subtitle: "Sonarr · simulación" },
      plex_added: { source: "plex", type: "library_added", title: "Nuevo contenido añadido a Plex", subtitle: "Tautulli · simulación" },
      notification: { source: "system", type: "test", title: "Notificación de prueba", subtitle: "Simulación desde Admin" }
    };
    const base = samples[kind] || samples.notification;
    const notification = await store.add({ ...base, priority: "normal", ...(req.body || {}) });
    await publishNotification(notification);
    return res.json({ ok: true, kind, notification });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});


async function cachePlexMetadataAssets(metadata = {}) {
  const normalized = { ...metadata, meta: { ...(metadata.meta || {}) } };

  if (normalized.posterUrl && /^https?:\/\//i.test(String(normalized.posterUrl))) {
    const poster = await assetService.cacheRemoteUrl(normalized.posterUrl, {
      bucket: "plex",
      title: `${normalized.title || "plex"}-poster`,
      cacheKey: `plex:poster:${normalized.ratingKey || normalized.canonicalRatingKey || normalized.canonicalId || normalized.posterUrl}:${normalized.posterUrl}`
    });
    normalized.meta.originalPosterUrl = normalized.posterUrl;
    normalized.posterUrl = poster.path;
  }

  if (normalized.backdropUrl && /^https?:\/\//i.test(String(normalized.backdropUrl))) {
    const backdrop = await assetService.cacheRemoteUrl(normalized.backdropUrl, {
      bucket: "plex",
      title: `${normalized.title || "plex"}-backdrop`,
      cacheKey: `plex:backdrop:${normalized.ratingKey || normalized.canonicalRatingKey || normalized.canonicalId || normalized.backdropUrl}:${normalized.backdropUrl}`
    });
    normalized.meta.originalBackdropUrl = normalized.backdropUrl;
    normalized.backdropUrl = backdrop.path;
  }

  return normalized;
}

function normalizePlexBacklogItem(metadata = {}) {
  return {
    source: "plex",
    type: metadata.type || "plex",
    collectionType: metadata.collectionType || (metadata.type === "movie" ? "movies" : "series"),
    canonicalId: metadata.canonicalId,
    ratingKey: metadata.ratingKey,
    title: metadata.title || "Contenido Plex",
    subtitle: metadata.subtitle || metadata.year || "",
    poster: metadata.posterUrl || null,
    backdrop: metadata.backdropUrl || null,
    year: metadata.year || "",
    meta: {
      ...(metadata.meta || {}),
      ratingKey: metadata.ratingKey,
      canonicalRatingKey: metadata.canonicalRatingKey,
      parentRatingKey: metadata.parentRatingKey || null,
      grandparentRatingKey: metadata.grandparentRatingKey || null,
      plexType: metadata.type || "unknown",
      grandparentTitle: metadata.showTitle || metadata.raw?.grandparentTitle || null,
      showTitle: metadata.showTitle || metadata.raw?.grandparentTitle || null,
      showPoster: metadata.showPosterUrl || null,
      showBackdrop: metadata.showBackdropUrl || null,
      year: metadata.year || "",
      releaseYear: metadata.year || "",
      studio: metadata.studio || metadata.raw?.studio || null,
      summary: metadata.summary || metadata.raw?.summary || null,
      genres: metadata.genres || metadata.raw?.Genre || [],
      raw: metadata.raw || null
    }
  };
}

function canonicalizePlexSeriesItem(item = {}) {
  if (item.source !== "plex") return item;
  const plexType = item.meta?.plexType || item.type;
  const isSeriesItem = item.collectionType === "series" || ["episode", "season", "show"].includes(plexType);
  if (!isSeriesItem || item.collectionType === "movies") return item;

  const canonicalRatingKey =
    item.meta?.canonicalRatingKey ||
    item.meta?.grandparentRatingKey ||
    item.grandparentRatingKey ||
    item.meta?.parentRatingKey ||
    item.parentRatingKey ||
    item.ratingKey;

  const canonicalId = item.canonicalId || (canonicalRatingKey ? `plex:series:${canonicalRatingKey}` : undefined);
  const showTitle =
    item.meta?.grandparentTitle ||
    item.meta?.showTitle ||
    item.meta?.seriesTitle ||
    item.title ||
    "Serie Plex";

  return {
    ...item,
    source: "plex",
    type: "show",
    collectionType: "series",
    canonicalId,
    ratingKey: canonicalRatingKey || item.ratingKey,
    title: showTitle,
    subtitle: "Serie",
    poster: item.meta?.showPoster || item.poster,
    backdrop: item.meta?.showBackdrop || item.backdrop,
    meta: {
      ...(item.meta || {}),
      plexType,
      originalType: plexType,
      originalRatingKey: item.ratingKey,
      originalTitle: item.title,
      originalSubtitle: item.subtitle,
      canonicalRatingKey: canonicalRatingKey || item.meta?.canonicalRatingKey || null
    }
  };
}

function normalizeDeckItem(input = {}) {
  if (!input) return input;
  if (input.source === "plex") return canonicalizePlexSeriesItem(input);
  return input;
}


function normalizePlayniteBacklogItem(game = {}) {
  return {
    source: "playnite",
    type: "game",
    collectionType: "games",
    canonicalId: `playnite:${String(game.gameId || game.title || "game").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "game"}`,
    gameId: game.gameId || game.title,
    title: game.title || "Juego sin título",
    subtitle: Array.isArray(game.platforms) ? game.platforms.join(" · ") : "",
    poster: game.cover || null,
    backdrop: game.background || null,
    year: game.releaseYear || "",
    releaseYear: game.releaseYear || "",
    platforms: game.platforms || [],
    developers: game.developers || [],
    publishers: game.publishers || [],
    genres: game.genres || [],
    playtime: game.playtime || null,
    meta: {
      ...(game.meta || {}),
      platforms: game.platforms || [],
      developers: game.developers || [],
      publishers: game.publishers || [],
      genres: game.genres || [],
      releaseYear: game.releaseYear || "",
      playtime: game.playtime || null,
      gameId: game.gameId || game.title || null,
      raw: game.raw || null
    }
  };
}

function broadcastBacklogAndCompletions() {
  const completionRatings = completionStore.ratingsMap();
  const collectionGroups = collectionGroupStore.list();
  hub.broadcast({ type: "backlog:update", payload: { backlog: publicBacklog(), completionRatings, onDeckMap: onDeckStore.map(), collectionGroups } });
  hub.broadcast({ type: "on-deck:update", payload: { onDeck: publicOnDeck(), completionRatings, collectionGroups } });
  hub.broadcast({ type: "completions:update", payload: publicCompletions() });
}
function broadcastCollectionGroups() {
  hub.broadcast({ type: "collection-groups:update", payload: collectionGroupStore.list() });
}

app.get("/api/backlog", (_req, res) => res.json({ backlog: publicBacklog(), completionRatings: completionStore.ratingsMap(), onDeckMap: onDeckStore.map() }));
app.get("/api/on-deck", (_req, res) => res.json({ onDeck: publicOnDeck(), completionRatings: completionStore.ratingsMap() }));

app.get("/api/collection-groups", (_req, res) => res.json({ groups: collectionGroupStore.list() }));
app.post("/api/collection-groups", async (req, res) => {
  try {
    const group = await collectionGroupStore.create(req.body || {});
    broadcastCollectionGroups();
    res.status(201).json({ ok: true, group });
  } catch (error) { res.status(400).json({ error: error.message }); }
});
app.patch("/api/collection-groups/:id", async (req, res) => {
  try {
    const group = await collectionGroupStore.update(req.params.id, req.body || {});
    broadcastCollectionGroups();
    res.json({ ok: true, group });
  } catch (error) { res.status(404).json({ error: error.message }); }
});
app.delete("/api/collection-groups/:id", async (req, res) => {
  try {
    const removed = await collectionGroupStore.remove(req.params.id);
    broadcastCollectionGroups();
    res.json({ ok: true, removed });
  } catch (error) { res.status(404).json({ error: error.message }); }
});
app.post("/api/collection-groups/:id/items", async (req, res) => {
  try {
    const itemId = req.body?.itemId;
    if (!itemId) return res.status(400).json({ error: "Falta itemId." });
    const group = await collectionGroupStore.addItem(req.params.id, itemId, req.body?.itemKeys || []);
    broadcastCollectionGroups();
    res.json({ ok: true, group });
  } catch (error) { res.status(404).json({ error: error.message }); }
});
app.delete("/api/collection-groups/:id/items/:itemId", async (req, res) => {
  try {
    const group = await collectionGroupStore.removeItem(req.params.id, req.params.itemId, { exclude: req.query.exclude === "1", itemKeys: req.body?.itemKeys || [] });
    broadcastCollectionGroups();
    res.json({ ok: true, group });
  } catch (error) { res.status(404).json({ error: error.message }); }
});


function normalizeCurrentToDeckItem(input = runtime.currentContent) {
  if (!input) throw new Error("No hay contenido actual.");
  const isGame = input.source === "playnite" || input.kind === "game" || input.platforms;
  return normalizeDeckItem(isGame ? normalizePlayniteBacklogItem(input) : normalizePlexBacklogItem(input));
}


function isGameInDeckOrCompleted(item = {}) {
  if (item.source !== "playnite") return false;
  const canonicalId = item.canonicalId || normalizePlayniteBacklogItem(item).canonicalId;
  return Boolean(onDeckStore.findByCanonicalId(canonicalId) || completionStore.findByCanonicalId(canonicalId));
}

async function updateOnDeckActivityFromItem(input = {}) {
  const item = normalizeDeckItem(input.source === "playnite" ? normalizePlayniteBacklogItem(input) : normalizePlexBacklogItem(input));
  if (!item?.canonicalId) return null;
  const existing = onDeckStore.findByCanonicalId(item.canonicalId);
  if (!existing) return null;
  const updated = await onDeckStore.upsert({
    ...existing,
    ...item,
    addedToDeckAt: existing.addedToDeckAt,
    lastActivityAt: new Date().toISOString()
  });
  broadcastBacklogAndCompletions();
  return updated;
}

async function removeWatchedPlexFromBacklog(metadata = {}) {
  const type = metadata.type || metadata.meta?.plexType || "unknown";
  const ratingKey = metadata.ratingKey;
  const canonicalId = metadata.canonicalId;
  const candidates = [];
  if (type === "movie" && canonicalId) candidates.push(canonicalId);
  if (type === "show" && canonicalId) candidates.push(canonicalId);
  if (ratingKey) candidates.push(`plex:${metadata.collectionType || (type === "movie" ? "movies" : "series")}:${ratingKey}`);
  if (ratingKey) candidates.push(String(ratingKey));

  for (const id of [...new Set(candidates.filter(Boolean))]) {
    const removed = await backlogStore.remove("plex", id).catch(() => null);
    if (removed) return removed;
  }
  return null;
}

async function completeItem(input, rating = 0) {
  const completed = await completionStore.complete({ ...input, rating });
  await onDeckStore.removeByCanonicalId(completed.canonicalId);
  return completed;
}

app.delete("/api/backlog/:source/:id", async (req, res) => {
  try {
    const removed = await backlogStore.remove(req.params.source, req.params.id);
    broadcastBacklogAndCompletions();
      res.json({ ok: true, removed });
  } catch (error) { res.status(404).json({ error: error.message }); }
});
app.post("/api/backlog/:source/:id/deck", async (req, res) => {
  try {
    const removed = await backlogStore.remove(req.params.source, req.params.id);
    const deckItem = await onDeckStore.upsert(normalizeDeckItem(removed));
    await completionStore.removeByCanonicalId(deckItem.canonicalId);
    broadcastBacklogAndCompletions();
      res.json({ ok: true, deckItem });
  } catch (error) { res.status(400).json({ error: error.message }); }
});
app.post("/api/backlog/:source/:id/complete", async (req, res) => {
  try {
    const removed = await backlogStore.remove(req.params.source, req.params.id);
    const completed = await completeItem(removed, req.body?.rating ?? 0);
    broadcastBacklogAndCompletions();
      res.json({ ok: true, completed });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.delete("/api/on-deck/:id", async (req, res) => {
  try { const removed = await onDeckStore.remove(req.params.id); broadcastBacklogAndCompletions(); broadcastState(); res.json({ ok: true, removed }); }
  catch (error) { res.status(404).json({ error: error.message }); }
});
app.post("/api/on-deck/:id/complete", async (req, res) => {
  try {
    const removed = await onDeckStore.remove(req.params.id);
    const completed = await completeItem(removed, req.body?.rating ?? 0);
    broadcastBacklogAndCompletions();
      res.json({ ok: true, completed });
  } catch (error) { res.status(400).json({ error: error.message }); }
});
app.post("/api/on-deck/:id/backlog", async (req, res) => {
  try {
    const removed = await onDeckStore.remove(req.params.id);
    const item = await backlogStore.upsert(removed.source, removed);
    broadcastBacklogAndCompletions();
      res.json({ ok: true, item });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.get("/api/completions", (_req, res) => res.json(completionStore.list()));
app.patch("/api/completions/:id", async (req, res) => {
  try { const item = await completionStore.update(req.params.id, req.body || {}); broadcastBacklogAndCompletions(); broadcastState(); res.json(item); }
  catch (error) { res.status(404).json({ error: error.message }); }
});
app.delete("/api/completions/:id", async (req, res) => {
  try { const removed = await completionStore.remove(req.params.id); broadcastBacklogAndCompletions(); broadcastState(); res.json({ ok: true, removed }); }
  catch (error) { res.status(404).json({ error: error.message }); }
});

app.post("/api/current/clear", async (_req, res) => {
  runtime.currentContent = null;
  await stateStore.update({ lastCurrent: null });
  hub.broadcast({ type: "current:update", payload: null });
  res.json({ ok: true });
});
app.post("/api/current/deck", async (_req, res) => {
  try {
    const item = normalizeCurrentToDeckItem();
    const deckItem = await onDeckStore.upsert(item);
    await completionStore.removeByCanonicalId(deckItem.canonicalId);
    await backlogStore.remove(deckItem.source, deckItem.canonicalId).catch(() => null);
    broadcastBacklogAndCompletions();
      res.json({ ok: true, deckItem });
  } catch (error) { res.status(400).json({ error: error.message }); }
});
app.post("/api/current/complete", async (req, res) => {
  try {
    const item = normalizeCurrentToDeckItem();
    const completed = await completeItem(item, req.body?.rating ?? 0);
    await backlogStore.remove(completed.source, completed.canonicalId).catch(() => null);
    broadcastBacklogAndCompletions();
      res.json({ ok: true, completed });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

async function handleTautulliWebhook(req, res) {
  console.log("Webhook Tautulli recibido", { path: req.path, event: req.body?.event || req.body?.event_type || "desconocido", ratingKey: req.body?.ratingKey || req.body?.rating_key || null });
  if (!settingsStore.get().integrations?.tautulli?.enabled) return res.status(200).json({ ok: true, ignored: true, reason: "Tautulli desactivado" });
  try {
    const ratingKey = req.body.ratingKey || req.body.rating_key;
    if (!ratingKey) return res.status(400).json({ error: "Falta ratingKey.", receivedKeys: Object.keys(req.body || {}) });
    let metadata = await plex.getMetadata(ratingKey);
    metadata = await cachePlexMetadataAssets(metadata);
    const event = normalizeTautulliEvent(req.body, metadata);
    runtime.plex = event.plex;
    runtime.currentContent = { ...event.plex, source: "plex", kind: "plex" };
    await stateStore.update({ lastPlex: runtime.plex, lastCurrent: runtime.currentContent });
    if (event.isWatched) {
      const removed = await removeWatchedPlexFromBacklog(metadata);
      if (removed) broadcastBacklogAndCompletions();
    }

    if (event.startsPlayback) {
      await updateOnDeckActivityFromItem({ ...metadata, source: "plex" });
    }

    const sources = backlogSources();
    const shouldAddToBacklog = !event.isWatched && ((event.isLibraryAdded && sources.plexRecentlyAdded) || (event.startsPlayback && sources.plexPlayback));
    if (shouldAddToBacklog) {
      const backlogItem = normalizePlexBacklogItem({
        ...metadata,
        meta: {
          ...(metadata.meta || {}),
          backlogSource: event.isLibraryAdded ? "plex_recently_added" : "plex_playback",
          tautulliEvent: event.rawEvent
        }
      });
      await backlogStore.upsert("plex", backlogItem);
      broadcastBacklogAndCompletions();
    }
    hub.broadcast({ type: "current:update", payload: runtime.currentContent });

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
    runtime.currentContent = { ...game, source: "playnite", kind: "game" };
    await stateStore.update({ lastGame: runtime.game, lastCurrent: runtime.currentContent });
    const playniteItem = normalizePlayniteBacklogItem(game);
    const deckUpdated = await updateOnDeckActivityFromItem({ ...game, source: "playnite" });
    if (!deckUpdated && !isGameInDeckOrCompleted(playniteItem) && backlogSources().playniteStarted) {
      await backlogStore.upsert("playnite", playniteItem);
      broadcastBacklogAndCompletions();
    } else if (deckUpdated || isGameInDeckOrCompleted(playniteItem)) {
      await backlogStore.remove("playnite", playniteItem.canonicalId).catch(() => null);
    }
    console.log("Webhook Playnite recibido", { title: game.title, platforms: game.platforms, hasCover: Boolean(game.cover), hasBackground: Boolean(game.background), payloadBytes: Number(req.headers["content-length"] || 0), persistedAssets: true });
    hub.broadcast({ type: "current:update", payload: runtime.currentContent });
    return res.status(200).json({ ok: true, event: game.event, title: game.title });
  } catch (error) {
    console.error("Error en webhook Playnite:", error);
    return res.status(400).json({ ok: false, error: error.message });
  }
}
app.post("/webhook/playnite", handlePlayniteWebhook);
