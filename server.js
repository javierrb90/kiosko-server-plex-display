import express from "express";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import { WebSocketServer } from "ws";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { EventStore } from "./src/event-store.js";
import { RealtimeHub } from "./src/realtime-hub.js";
import { PlexService } from "./src/services/plex-service.js";
import { normalizeTautulliEvent } from "./src/adapters/tautulli.js";
import { normalizeArrEvent } from "./src/adapters/arr.js";
import { normalizePlayniteEvent } from "./src/adapters/playnite.js";
import { normalizeIngestionPayload, ingestionExample } from "./src/services/ingestion-contract.js";
import { SettingsStore } from "./src/settings-store.js";
import { StateStore } from "./src/state-store.js";
import { AssetService } from "./src/asset-service.js";
import { BacklogStore, CompletionStore } from "./src/backlog-store.js";
import { CollectionGroupStore } from "./src/collection-group-store.js";
import { OnDeckStore } from "./src/on-deck-store.js";
import { ItemRegistryStore } from "./src/item-registry-store.js";
import { JournalStore } from "./src/journal-store.js";

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
  console.log(`BBQueue v6.14.2 escuchando en ${host}:${port}`);
  console.log(`Datos persistentes: ${DATA_DIR}`);
  if (firstLan) console.log(`Acceso local sugerido: http://${firstLan}:${port}`);
  console.log(`Diagnóstico: /api/health · /api/diagnostics`);
}


const diagnosticsMetrics = {
  startedAt: new Date().toISOString(),
  requests: [],
  actions: [],
  broadcasts: [],
  payloads: [],
  snapshots: [],
  persists: []
};
function pushMetric(bucket, entry, limit = 80) {
  const list = diagnosticsMetrics[bucket];
  if (!Array.isArray(list)) return;
  list.push({ at: new Date().toISOString(), ...entry });
  if (list.length > limit) list.splice(0, list.length - limit);
}
async function fileStatSafe(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return { exists: true, bytes: stat.size, modifiedAt: stat.mtime.toISOString() };
  } catch (error) {
    return { exists: false, bytes: 0, error: error.code || error.message };
  }
}
async function dataFileDiagnostics() {
  const files = [
    "state.json",
    "settings.json",
    "backlog.json",
    "on-deck.json",
    "completed-items.json",
    "collection-groups.json",
    "items.json",
    "item-activity.json",
    "item-journals.json",
    "backlog-entries.json",
    "notifications.json",
    "notification-idempotency.json"
  ];
  const entries = {};
  for (const name of files) entries[name] = await fileStatSafe(path.join(DATA_DIR, name));
  return entries;
}
function dataCounts() {
  const backlog = backlogStore.list();
  return {
    backlog: {
      plex: Array.isArray(backlog.plex) ? backlog.plex.length : 0,
      playnite: Array.isArray(backlog.playnite) ? backlog.playnite.length : 0,
      kiosko: Array.isArray(backlog.kiosko) ? backlog.kiosko.length : 0,
      manual: Array.isArray(backlog.manual) ? backlog.manual.length : 0,
      total: Object.values(backlog || {}).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0)
    },
    onDeck: onDeckStore.list().length,
    completions: completionStore.list().length,
    collectionGroups: collectionGroupStore.list().length,
    itemRegistry: itemRegistryStore.diagnostics().counts,
    notifications: store.list({ page: 1, limit: 1 }).total
  };
}
function runtimeDiagnosticsSummary() {
  return {
    uptimeSeconds: Math.round(process.uptime()),
    memory: process.memoryUsage(),
    wsClients: hub?.clientCount?.() || 0,
    activeView: runtime?.activeView || null,
    currentContent: runtime?.currentContent ? {
      source: runtime.currentContent.source || runtime.currentContent.kind || null,
      title: runtime.currentContent.title || null,
      type: runtime.currentContent.type || null
    } : null
  };
}

app.use(express.json({ limit: `${maxPayloadMb}mb` }));


const slowApiThresholdMs = Number(process.env.SLOW_API_LOG_MS || 750);
app.use((req, res, next) => {
  const started = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - started;
    const noisy = req.path.startsWith("/assets/") || req.path === "/favicon.ico";
    const entry = { method: req.method, url: req.originalUrl, status: res.statusCode, ms, ip: req.ip || req.socket?.remoteAddress || "unknown" };
    if (req.path.startsWith("/api/")) pushMetric("requests", entry);
    if (process.env.DEBUG_HTTP === "1" && !noisy) console.log(`[http] ${req.method} ${req.originalUrl} -> ${res.statusCode} ${ms}ms from ${entry.ip}`);
    else if (req.path.startsWith("/api/") && ms > slowApiThresholdMs) console.warn(`[slow-api] ${req.method} ${req.originalUrl} -> ${res.statusCode} ${ms}ms`);
  });
  next();
});

app.get("/api/diagnostics", async (_req, res) => {
  const addresses = getLocalAddresses();
  const snapshotStarted = Date.now();
  const snapshotPayload = snapshot().payload;
  const snapshotBytes = approxBytes(snapshotPayload);
  const files = await dataFileDiagnostics();
  res.json({
    ok: true,
    app: "BBQueue",
    version: "v6.14.2",
    pid: process.pid,
    cwd: process.cwd(),
    node: process.version,
    env: process.env.NODE_ENV || null,
    port: PORT,
    dataDir: DATA_DIR,
    dockerLikely: isProbablyDocker(),
    interfaces: addresses,
    suggestedUrls: [`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`, ...addresses.map(entry => `http://${entry.address}:${PORT}`)],
    runtime: runtimeDiagnosticsSummary(),
    config: {
      debugHttp: process.env.DEBUG_HTTP === "1",
      traceItems: process.env.TRACE_ITEMS === "1",
      traceWs: process.env.TRACE_WS === "1",
      slowApiLogMs: slowApiThresholdMs,
      tracePayloadBytes: Number(process.env.TRACE_PAYLOAD_BYTES || 250000),
      persistDebounceMs: Number(process.env.PERSIST_DEBOUNCE_MS || 350),
      maxPayloadMb
    },
    counts: dataCounts(),
    itemRegistry: itemRegistryStore.diagnostics(),
    files,
    payloads: {
      snapshotBytes,
      snapshotBuildMs: Date.now() - snapshotStarted
    },
    recent: diagnosticsMetrics,
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
const itemRegistryStore = new ItemRegistryStore(DATA_DIR);
const journalStore = new JournalStore(DATA_DIR);
await Promise.all([store.init(), stateStore.init(), assetService.init(), backlogStore.init(), completionStore.init(), collectionGroupStore.init(), onDeckStore.init(), itemRegistryStore.init(), journalStore.init()]);
await itemRegistryStore.syncFromViews({ backlog: backlogStore.list(), onDeck: onDeckStore.list(), completions: completionStore.list() }, "startup");

const plex = new PlexService(settingsStore.get().plex || {});

const validViews = new Set(["database", "backlog", "on-deck", "current-content", "collections"]);
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
  printStartupDiagnostics(PORT, "0.0.0.0");
  console.log(`Plex configurado: ${status.plexConfigured ? "sí" : "NO"} (URL: ${status.plexUrlConfigured ? "sí" : "no"}, token: ${status.plexTokenConfigured ? "sí" : "no"})`);
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
  const canonicalId = item.canonicalId || item.id;
  return { ...item, meta, ...(canonicalId ? journalStore.summary(String(canonicalId)) : {}) };
}

function publicBacklog() {
  const data = backlogStore.list();
  return {
    plex: (data.plex || []).map(publicItem),
    playnite: (data.playnite || []).map(publicItem),
    kiosko: (data.kiosko || []).map(publicItem),
    manual: (data.manual || []).map(publicItem)
  };
}

function publicOnDeck() {
  return onDeckStore.list().map(publicItem);
}

function publicCompletions() {
  return completionStore.list().map(publicItem);
}

function fullStatePayload(extra = {}) {
  return {
    ...extra,
    backlog: publicBacklog(),
    onDeck: publicOnDeck(),
    completions: publicCompletions(),
    completionRatings: completionStore.ratingsMap(),
    onDeckMap: onDeckStore.map()
  };
}

async function syncItemRegistryNow(reason = "action") {
  return itemRegistryStore.syncFromViews({
    backlog: backlogStore.list(),
    onDeck: onDeckStore.list(),
    completions: completionStore.list()
  }, reason);
}

function findBacklogItemByCanonicalId(canonicalId = "") {
  const data = backlogStore.list();
  return Object.values(data || {}).flat().find(item => item.canonicalId === canonicalId || item.id === canonicalId);
}
function findOnDeckItemByCanonicalId(canonicalId = "") {
  return onDeckStore.list().find(item => item.canonicalId === canonicalId || item.id === canonicalId);
}
function findCompletionByCanonicalId(canonicalId = "") {
  return completionStore.list().find(item => item.canonicalId === canonicalId || item.id === canonicalId);
}
function itemFromAnyStore(canonicalId = "") {
  return itemRegistryStore.get(canonicalId) || findBacklogItemByCanonicalId(canonicalId) || findOnDeckItemByCanonicalId(canonicalId) || findCompletionByCanonicalId(canonicalId);
}

const TRACE_ITEMS = process.env.TRACE_ITEMS === "1" || process.env.TRACE_DELTA === "1";
function approxBytes(value) {
  try { return Buffer.byteLength(JSON.stringify(value), "utf8"); } catch { return 0; }
}
function tracePayload(label, payload) {
  const bytes = approxBytes(payload);
  pushMetric("payloads", { label, bytes });
  if (TRACE_ITEMS || bytes > Number(process.env.TRACE_PAYLOAD_BYTES || 250000)) console.log(`[payload] ${label} bytes=${bytes}`);
  return bytes;
}
function traceStep(label, started) {
  if (!TRACE_ITEMS) return;
  console.log(`[trace] ${label} ${Date.now() - started}ms`);
}
function broadcastDelta(type, payload = {}) {
  tracePayload(type, payload);
  const result = hub.broadcast({ type, payload }, { trace: TRACE_ITEMS || process.env.TRACE_WS === "1" });
  pushMetric("broadcasts", { type, clients: result.clients, bytes: result.bytes, ms: result.ms });
  if (String(type || "").startsWith("item:")) scheduleItemRegistrySync(type);
  if (TRACE_ITEMS) console.log(`[delta] ${type} clients=${result.clients} bytes=${result.bytes} ms=${result.ms}`);
}
function traceActionStart(name, req) {
  const started = Date.now();
  console.log(`[action:start] ${name} ${req.method} ${req.originalUrl} ws=${hub.clientCount()}`);
  return started;
}
function traceActionEnd(name, started, extra = {}) {
  const ms = Date.now() - started;
  pushMetric("actions", { name, ms, ...extra });
  console.log(`[action:end] ${name} ${ms}ms ${Object.entries(extra).map(([k,v]) => `${k}=${v}`).join(" ")}`);
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
    itemRegistry: itemRegistryStore.list(),
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
  console.log(`[ws] conectado activos=${hub.clientCount()}`);
  ws.on("close", () => console.log(`[ws] cerrado activos=${hub.clientCount()}`));
  hub.send(ws, { type: "socket:ready", payload: { ok: true } });
});

app.get("/api/health", (_req, res) => res.json({ ok: true, app: "BBQueue", version: "v6.14.2", pid: process.pid, uptimeSeconds: Math.round(process.uptime()), time: new Date().toISOString(), ...configStatus(), notifications: store.list({ page: 1, limit: 1 }).total, backlog: backlogStore.source("plex").length + backlogStore.source("playnite").length + backlogStore.source("kiosko").length + backlogStore.source("manual").length, onDeck: onDeckStore.list().length, collection: completionStore.list().length }));
app.get("/api/snapshot", (_req, res) => {
  const started = Date.now();
  const payload = snapshot().payload;
  const bytes = tracePayload("snapshot", payload);
  const ms = Date.now() - started;
  pushMetric("snapshots", { ms, bytes, wsClients: hub.clientCount() });
  res.json(payload);
  if (TRACE_ITEMS || ms > 500) console.log(`[snapshot] ${ms}ms bytes=${bytes} ws=${hub.clientCount()}`);
});
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
  res.setHeader("Content-Disposition", `attachment; filename=\"bbqueue-backup-${stamp}.json\"`);
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
      const plexItem = normalizePlexBacklogItem(runtime.plex);
      await itemRegistryStore.upsert(plexItem, { charred: shouldClearCharred("plexPlayback") ? false : undefined, activity: { eventType: "plex_simulated", title: plexItem.title, subtitle: plexItem.subtitle, activityAt: new Date().toISOString() } });
      await syncItemRegistryNow("simulate-plex");
      hub.broadcast({ type: "current:update", payload: runtime.currentContent });
      broadcastDelta("item:database-updated", fullStatePayload({ item: publicItem(itemRegistryStore.get(plexItem.canonicalId) || plexItem) }));
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
      await itemRegistryStore.upsert(playniteItem, { charred: shouldClearCharred("playniteStarted") ? false : undefined, activity: { eventType: "playnite_simulated", title: playniteItem.title, subtitle: playniteItem.subtitle, activityAt: new Date().toISOString() } });
      await updateOnDeckActivityFromItem({ ...runtime.game, source: "playnite" });
      await syncItemRegistryNow("simulate-playnite");
      hub.broadcast({ type: "current:update", payload: runtime.currentContent });
      broadcastDelta("item:database-updated", fullStatePayload({ item: publicItem(itemRegistryStore.get(playniteItem.canonicalId) || playniteItem) }));
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


function plexSeriesCanonicalIdForMetadata(metadata = {}) {
  const key = metadata.grandparentRatingKey || metadata.parentRatingKey || metadata.canonicalRatingKey || metadata.ratingKey || metadata.meta?.grandparentRatingKey || metadata.meta?.canonicalRatingKey;
  return key ? `plex:series:${key}` : null;
}

function normalizePlexCreatedBacklogItem(metadata = {}, event = {}) {
  const base = normalizePlexBacklogItem({
    ...metadata,
    meta: {
      ...(metadata.meta || {}),
      backlogSource: "plex_recently_added",
      tautulliEvent: event.rawEvent || event.event || "created"
    }
  });

  const plexType = metadata.type || metadata.meta?.plexType || "unknown";
  if (plexType !== "episode") return base;

  const seriesCanonicalId = plexSeriesCanonicalIdForMetadata(metadata);
  const episodeCanonicalId = seriesCanonicalId || base.canonicalId;
  const episodeTitle = metadata.raw?.title || metadata.meta?.originalTitle || "";
  const episodeCode = String(metadata.subtitle || "").split("·").pop()?.trim() || "";
  const subtitleParts = ["Nuevo episodio"];
  if (episodeCode) subtitleParts.push(episodeCode);
  if (episodeTitle && !String(metadata.subtitle || "").includes(episodeTitle)) subtitleParts.push(episodeTitle);

  return {
    ...base,
    type: "episode",
    collectionType: "series",
    canonicalId: episodeCanonicalId,
    ratingKey: metadata.ratingKey,
    title: metadata.showTitle || base.title || "Serie Plex",
    subtitle: subtitleParts.join(" · ") || metadata.subtitle || "Nuevo episodio",
    meta: {
      ...(base.meta || {}),
      plexType: "episode",
      originalType: "episode",
      originalRatingKey: metadata.ratingKey || null,
      originalTitle: episodeTitle || metadata.title || null,
      originalSubtitle: metadata.subtitle || null,
      relatedSeriesCanonicalId: seriesCanonicalId,
      relatedOnDeckCanonicalId: seriesCanonicalId,
      createdEpisodeRatingKey: metadata.ratingKey || null,
      createdEpisodeTitle: episodeTitle || null,
      createdEpisodeCode: episodeCode || null,
      createdFromTautulli: true
    }
  };
}


function plexActivityDetail(metadata = {}, event = {}) {
  const plexType = metadata.type || metadata.meta?.plexType || "unknown";
  const episodeTitle = metadata.raw?.title || metadata.meta?.originalTitle || metadata.title || "";
  const episodeCode = String(metadata.subtitle || metadata.meta?.createdEpisodeCode || "").split("·").pop()?.trim() || "";
  if (["episode", "season"].includes(plexType)) {
    const parts = [];
    if (episodeTitle) parts.push(episodeTitle);
    if (episodeCode && !parts.some(part => String(part).includes(episodeCode))) parts.push(episodeCode);
    const suffix = event.isWatched ? "terminado" : event.isLibraryAdded ? "añadido" : event.startsPlayback ? "reproducido" : "";
    return [parts.join(" · ") || metadata.subtitle || "Episodio", suffix].filter(Boolean).join(" · ");
  }
  if (event.isWatched) return metadata.subtitle ? `${metadata.subtitle} · terminado` : "Terminado";
  if (event.isLibraryAdded) return metadata.subtitle ? `${metadata.subtitle} · añadido` : "Añadido";
  return metadata.subtitle || metadata.summary || metadata.year || "";
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
    subtitle: item.detail || item.subtitle || item.meta?.originalSubtitle || item.meta?.createdEpisodeCode || "Serie",
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

function deckCategoryFor(item = {}) {
  if (item.collectionType === "games" || item.source === "playnite") return "games";
  if (item.collectionType === "movies") return "movies";
  return "series";
}
const deckLimitByCategory = { games: 3, movies: 3, series: 3 };
function deckItemsForCategory(category) {
  return onDeckStore.list().filter(item => deckCategoryFor(item) === category);
}
function deckLimitPayload(category, newItem = {}) {
  return {
    reason: "deck_limit_reached",
    category,
    limit: deckLimitByCategory[category] || 3,
    newItem: publicItem(newItem),
    currentItems: deckItemsForCategory(category).map(publicItem)
  };
}
async function enforceDeckLimitOrReplace(deckItem = {}, replaceId = "") {
  const category = deckCategoryFor(deckItem);
  const limit = deckLimitByCategory[category] || 3;
  const current = deckItemsForCategory(category);
  const already = current.find(item => item.canonicalId === deckItem.canonicalId || item.id === deckItem.id);
  if (already) return { ok: true, replaced: null, category };
  if (current.length < limit) return { ok: true, replaced: null, category };
  if (!replaceId) return { ok: false, payload: deckLimitPayload(category, deckItem), category };
  const replaced = await onDeckStore.remove(replaceId);
  return { ok: true, replaced, category };
}
function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function itemsToCsv(rows = []) {
  const headers = ["title", "subtitle", "source", "type", "collectionType", "status", "rating", "completedAt", "firstSeenAt", "lastActivityAt", "canonicalId"];
  const lines = [headers.join(",")];
  for (const item of rows) {
    lines.push(headers.map(key => csvEscape(item[key])).join(","));
  }
  return lines.join("\n");
}

function keysForPermanentDelete(item = {}) {
  const meta = item.meta || item.metadata || {};
  return [...new Set([
    item.id,
    item.canonicalId,
    item.entityId,
    item.gameId,
    meta.gameId,
    item.ratingKey,
    meta.ratingKey,
    meta.canonicalRatingKey,
    meta.relatedSeriesCanonicalId,
    meta.relatedOnDeckCanonicalId
  ].filter(Boolean).map(String))];
}
function localAssetPathFor(url = "") {
  const value = String(url || "");
  if (!value.startsWith("/assets/")) return null;
  const cleanRelative = value.replace(/^\/assets\//, "").split("?")[0];
  if (!cleanRelative || cleanRelative.includes("..")) return null;
  return path.join(DATA_DIR, "assets", cleanRelative);
}
async function deleteOwnedAssetsForItem(item = {}) {
  const candidates = [item.poster, item.posterUrl, item.cover, item.backdrop, item.backdropUrl, item.background].map(localAssetPathFor).filter(Boolean);
  const deleted = [];
  for (const filePath of [...new Set(candidates)]) {
    try { await fs.unlink(filePath); deleted.push(filePath); } catch {}
  }
  return deleted;
}
async function removeFromBacklogEverywhere(item = {}) {
  const keys = keysForPermanentDelete(item);
  for (const source of ["plex", "playnite", item.source].filter(Boolean)) {
    for (const key of keys) await backlogStore.remove(source, key).catch(() => null);
  }
}
async function deletePermanentEverywhere(item = {}) {
  const keys = keysForPermanentDelete(item);
  await removeFromBacklogEverywhere(item);
  for (const key of keys) await onDeckStore.remove(key).catch(() => null);
  for (const key of keys) { await completionStore.removeByCanonicalId(key).catch(() => null); await completionStore.remove(key).catch(() => null); }
  await collectionGroupStore.removeItemEverywhere(keys).catch(() => null);
  const deletedAssets = await deleteOwnedAssetsForItem(item);
  const removed = await itemRegistryStore.deletePermanent(item.canonicalId || item.id);
  return { removed, deletedAssets, keys };
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


let registrySyncTimer = null;
function scheduleItemRegistrySync(reason = "scheduled") {
  if (registrySyncTimer) return;
  registrySyncTimer = setTimeout(() => {
    registrySyncTimer = null;
    itemRegistryStore.syncFromViews({
      backlog: backlogStore.list(),
      onDeck: onDeckStore.list(),
      completions: completionStore.list()
    }, reason).then(result => {
      if (TRACE_ITEMS) console.log(`[item-registry] sync reason=${result.reason} total=${result.total} ms=${result.ms}`);
    }).catch(error => console.error("[item-registry] sync error:", error));
  }, Number(process.env.ITEM_REGISTRY_SYNC_DEBOUNCE_MS || 250));
}

function broadcastBacklogAndCompletions() {
  scheduleItemRegistrySync("broadcastBacklogAndCompletions");
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

function grillTypeFor(item = {}) {
  const raw = String(item.collectionType || item.type || item.meta?.plexType || "series").toLowerCase();
  if (["movie","movies","film","pelicula","peliculas"].includes(raw)) return "movies";
  if (["game","games","juego","juegos"].includes(raw)) return "games";
  if (["show","shows","series","serie","episode","season","tv"].includes(raw)) return "series";
  return raw || "series";
}
function grillLimitFor(item = {}, viewName = "backlog") {
  const grill = settingsStore.get().grill || {};
  const type = grillTypeFor(item);
  const configured = grill.limits?.[type]?.[viewName];
  if (configured === false) return null;
  return Number(configured || grill.defaults?.[viewName] || (viewName === "onDeck" ? 7 : 30));
}
function shouldClearCharred(kind = "manual") {
  const policy = settingsStore.get().grill?.clearCharredOn || {};
  if (kind === "plexPlayback") return policy.plexPlayback === true;
  if (kind === "plexLibraryAdded") return policy.plexLibraryAdded === true;
  if (kind === "playniteStarted") return policy.playniteStarted !== false;
  if (kind === "journal") return policy.journal !== false;
  return policy.manual !== false;
}
function grillInfo(item = {}) {
  const states = item.states || {};
  if (states.completed || item.completedAt) return { active: false, charred: false, hot: false, overdue: false, manualCharred: false };
  const viewName = states.inOnDeck ? "onDeck" : states.inBacklog ? "backlog" : null;
  const manualCharred = Boolean(states.charred);
  if (!viewName || settingsStore.get().grill?.enabled === false) return { active: manualCharred, charred: manualCharred, hot: false, overdue: false, manualCharred, view: viewName };
  const limit = grillLimitFor(item, viewName);
  if (!limit) return { active: manualCharred, charred: manualCharred, hot: false, overdue: false, manualCharred, view: viewName };
  const elapsed = Math.max(0, (Date.now() - (Date.parse(item.lastActivityAt || item.updatedAt || item.createdAt) || Date.now())) / 86400000);
  const hotThreshold = Math.max(1, limit * .45);
  const overdue = elapsed > limit;
  return { active: true, charred: manualCharred || overdue, hot: !manualCharred && elapsed >= hotThreshold && elapsed <= limit, overdue, manualCharred, progress: Math.min(1, elapsed / limit), view: viewName, turned: Boolean(states.turnedAt) };
}
function publicGrillItem(item = {}) { return { ...publicItem(item), grill: grillInfo(item) }; }

app.get("/api/grill/pending", async (_req, res) => {
  await syncItemRegistryNow("grill-check");
  const items = itemRegistryStore.list().filter(item => grillInfo(item).overdue).map(publicGrillItem);
  res.json({ items, total: items.length });
});
app.post("/api/items/:canonicalId/grill/turn", async (req, res) => {
  const id = decodeURIComponent(req.params.canonicalId); const item = itemRegistryStore.get(id);
  if (!item) return res.status(404).json({ error: "Item no encontrado." });
  const activityAt = new Date().toISOString();
  const updated = await itemRegistryStore.upsert({ ...item, lastActivityAt: activityAt }, { lastActivityAt: activityAt, charred: false, turnedAt: null, activity: { eventType: "grill_turn", title: item.title, subtitle: item.subtitle, activityAt } });
  await syncItemRegistryNow("grill-turn"); const payload = fullStatePayload({ item: publicGrillItem(itemRegistryStore.get(id) || updated) });
  broadcastDelta("item:database-updated", payload); res.json({ ok: true, item: payload.item });
});
app.post("/api/items/:canonicalId/grill/char", async (req, res) => {
  const id = decodeURIComponent(req.params.canonicalId); const item = itemFromAnyStore(id);
  if (!item) return res.status(404).json({ error: "Item no encontrado." });
  const updated = await itemRegistryStore.upsert(item, { charred: true, turnedAt: null });
  await syncItemRegistryNow("grill-char"); const payload = fullStatePayload({ item: publicGrillItem(itemRegistryStore.get(id) || updated) });
  broadcastDelta("item:database-updated", payload); res.json({ ok: true, item: payload.item });
});
app.delete("/api/items/:canonicalId/grill/char", async (req, res) => {
  const id = decodeURIComponent(req.params.canonicalId); const item = itemRegistryStore.get(id);
  if (!item) return res.status(404).json({ error: "Item no encontrado." });
  const updated = await itemRegistryStore.upsert(item, { charred: false, turnedAt: null });
  const payload = fullStatePayload({ item: publicGrillItem(updated) }); broadcastDelta("item:database-updated", payload); res.json({ ok: true, item: payload.item });
});

app.get("/api/items", async (req, res) => {
  if (process.env.ITEM_REGISTRY_SYNC_ON_QUERY !== "0" || itemRegistryStore.count() === 0 || req.query?.sync === "1") {
    await syncItemRegistryNow("items-api");
  }
  const result = itemRegistryStore.query(req.query || {});
  res.json({ ...result, items: result.items.map(publicGrillItem) });
});
app.get("/api/items/export.csv", async (req, res) => {
  if (itemRegistryStore.count() === 0 || req.query?.sync === "1") await syncItemRegistryNow("items-export");
  const query = { ...(req.query || {}), page: 1, limit: 10000 };
  const result = itemRegistryStore.query(query);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="bbqueue-items-${new Date().toISOString().slice(0,10)}.csv"`);
  res.send(itemsToCsv(result.items));
});

function slugType(value = "") {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}
function normalizeManualCollectionType(value = "") {
  const text = slugType(value);
  if (["game", "games", "juego", "juegos"].includes(text)) return "games";
  if (["movie", "movies", "pelicula", "peliculas"].includes(text)) return "movies";
  if (["show", "series", "serie"].includes(text)) return "series";
  return text || "movies";
}
function manualTypeForCollection(collectionType = "") {
  if (collectionType === "games") return "game";
  if (collectionType === "movies") return "movie";
  if (collectionType === "series") return "show";
  return "item";
}
async function updateManualItemInLegacyStores(item = {}) {
  const id = item.canonicalId || item.id;
  if (!id) return;
  const backlogItem = findBacklogItemByCanonicalId(id);
  if (backlogItem) {
    const source = backlogItem.source === "plex" || backlogItem.source === "playnite" || backlogItem.source === "kiosko" || backlogItem.source === "manual" ? backlogItem.source : "manual";
    await backlogStore.upsert(source, { ...backlogItem, ...item, id: backlogItem.id, source, lastActivityAt: item.lastActivityAt || backlogItem.lastActivityAt });
  }
  const deckItem = findOnDeckItemByCanonicalId(id);
  if (deckItem) await onDeckStore.upsert({ ...deckItem, ...item, id: deckItem.id, addedToDeckAt: deckItem.addedToDeckAt, lastActivityAt: item.lastActivityAt || deckItem.lastActivityAt });
  const completedItem = findCompletionByCanonicalId(id);
  if (completedItem) await completionStore.complete({ ...completedItem, ...item, id: completedItem.id, rating: completedItem.rating, completedAt: completedItem.completedAt });
}
async function prepareManualItemPayload(input = {}, existing = null) {
  const title = String(input.title || existing?.title || "").trim();
  if (!title) throw new Error("El título es obligatorio.");
  const collectionType = normalizeManualCollectionType(input.collectionType || input.type || existing?.collectionType || "movies");
  const id = existing?.canonicalId || input.canonicalId || `kiosko:${crypto.randomUUID()}`;
  const assetTitle = title || "manual-item";
  let poster = input.poster ?? input.posterUrl ?? input.cover ?? existing?.poster ?? null;
  let backdrop = input.backdrop ?? input.backdropUrl ?? input.background ?? existing?.backdrop ?? null;
  if (input.posterAsset) poster = (await assetService.saveImage(input.posterAsset, { bucket: "manual", title: `${assetTitle}-poster` })).path;
  else if (input.poster && !String(input.poster).startsWith("/assets/") && /^(data:image\/|https?:\/\/)/i.test(String(input.poster))) poster = (await assetService.saveImage(input.poster, { bucket: "manual", title: `${assetTitle}-poster` })).path;
  if (input.backdropAsset) backdrop = (await assetService.saveImage(input.backdropAsset, { bucket: "manual", title: `${assetTitle}-backdrop` })).path;
  else if (input.backdrop && !String(input.backdrop).startsWith("/assets/") && /^(data:image\/|https?:\/\/)/i.test(String(input.backdrop))) backdrop = (await assetService.saveImage(input.backdrop, { bucket: "manual", title: `${assetTitle}-backdrop` })).path;
  if (!poster) throw new Error("La carátula es obligatoria.");
  if (!backdrop) backdrop = poster;
  const nowIso = new Date().toISOString();
  const detail = String(input.detail ?? input.subtitle ?? existing?.detail ?? existing?.subtitle ?? "").trim();
  return {
    ...(existing || {}),
    id: existing?.id || id,
    canonicalId: id,
    entityId: id,
    source: "kiosko",
    kind: "manual",
    type: manualTypeForCollection(collectionType),
    collectionType,
    title,
    detail,
    subtitle: detail,
    poster,
    backdrop,
    year: input.year ?? existing?.year ?? "",
    firstSeenAt: existing?.firstSeenAt || nowIso,
    lastActivityAt: input.bumpActivity === false ? (existing?.lastActivityAt || nowIso) : nowIso,
    meta: {
      ...(existing?.meta || existing?.metadata || {}),
      createdByKiosko: true,
      manualItem: true
    }
  };
}
function isManualEditableItem(item = {}) {
  return item.source === "kiosko" || item.source === "manual" || item.meta?.createdByKiosko || item.metadata?.createdByKiosko;
}

app.get("/api/items/metadata-keys", async (_req, res) => {
  await syncItemRegistryNow("metadata-keys");
  const buckets = { games: {}, movies: {}, series: {}, all: {} };
  const add = (bucket, key, value) => {
    if (!key || value === undefined || value === null || value === "") return;
    const target = buckets[bucket] || buckets.all;
    target[key] = (target[key] || 0) + 1;
    buckets.all[key] = (buckets.all[key] || 0) + 1;
  };
  for (const item of itemRegistryStore.list()) {
    const bucket = item.collectionType === "games" ? "games" : item.collectionType === "movies" ? "movies" : "series";
    for (const [key, value] of Object.entries(item || {})) {
      if (["meta", "metadata", "states"].includes(key)) continue;
      add(bucket, key, value);
    }
    const meta = item.meta || item.metadata || {};
    for (const [key, value] of Object.entries(meta)) add(bucket, `meta.${key}`, value);
  }
  res.json({ keys: buckets });
});

app.post("/api/items", async (req, res) => {
  try {
    const payload = await prepareManualItemPayload(req.body || {});
    const item = await itemRegistryStore.upsert(payload, { activity: { eventType: "manual_created", title: payload.title, subtitle: payload.subtitle, activityAt: payload.lastActivityAt } });
    await syncItemRegistryNow("manual-create");
    const responsePayload = fullStatePayload({ item: publicItem(itemRegistryStore.get(item.canonicalId) || item) });
    broadcastDelta("item:database-updated", responsePayload);
    res.status(201).json({ ok: true, item: itemRegistryStore.get(item.canonicalId) || item });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
app.patch("/api/items/:canonicalId", async (req, res) => {
  try {
    const id = decodeURIComponent(req.params.canonicalId);
    const existing = itemRegistryStore.get(id);
    if (!existing) return res.status(404).json({ error: "Item no encontrado." });
    if (!isManualEditableItem(existing)) return res.status(403).json({ error: "Sólo se pueden editar datos principales de items creados manualmente en BBQueue." });
    const payload = await prepareManualItemPayload({ ...(req.body || {}), canonicalId: existing.canonicalId }, existing);
    let item = await itemRegistryStore.upsert(payload, { forceSubtitle: true, activity: { eventType: "manual_item_edit", title: payload.title, subtitle: payload.subtitle, activityAt: payload.lastActivityAt } });
    await updateManualItemInLegacyStores(item);
    await syncItemRegistryNow("manual-edit");
    item = itemRegistryStore.get(item.canonicalId) || item;
    const responsePayload = fullStatePayload({ item: publicItem(itemRegistryStore.get(item.canonicalId) || item) });
    broadcastDelta("item:database-updated", responsePayload);
    res.json({ ok: true, item: itemRegistryStore.get(item.canonicalId) || item });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/items/:canonicalId", async (req, res) => {
  await syncItemRegistryNow("item-get");
  const item = itemRegistryStore.get(decodeURIComponent(req.params.canonicalId));
  if (!item) return res.status(404).json({ error: "Item no encontrado." });
  res.json(publicGrillItem(item));
});
app.patch("/api/items/:canonicalId/dates", async (req, res) => {
  const id = decodeURIComponent(req.params.canonicalId);
  let item = await itemRegistryStore.updateDates(id, req.body || {});
  if (!item) return res.status(404).json({ error: "Item no encontrado." });

  // La fecha editada debe ser autoritativa también en las vistas históricas.
  // De lo contrario, la siguiente sincronización vuelve a importar la fecha antigua
  // desde Backlog, On Deck o Colección y hace imposible depurar la parrilla.
  await updateManualItemInLegacyStores(item);
  await syncItemRegistryNow("manual-dates-edit");
  item = itemRegistryStore.get(id) || item;

  const payload = fullStatePayload({ item: publicGrillItem(item) });
  broadcastDelta("item:database-updated", payload);
  res.json({ ok: true, item });
});
async function handlePermanentItemDelete(req, res) {
  const id = decodeURIComponent(req.params.canonicalId || req.body?.canonicalId || "");
  const item = itemFromAnyStore(id);
  if (!item) return res.status(404).json({ error: "Item no encontrado." });
  const result = await deletePermanentEverywhere(item);
  await journalStore.removeItem(String(item.canonicalId || item.id));
  await syncItemRegistryNow("permanent-delete");
  const payload = fullStatePayload({ item: publicItem(item), canonicalId: item.canonicalId, keys: result.keys });
  broadcastDelta("item:permanently-deleted", payload);
  broadcastCollectionGroups();
  res.json({ ok: true, ...result, item });
}
app.delete("/api/items/:canonicalId", handlePermanentItemDelete);
app.post("/api/items/:canonicalId/delete", handlePermanentItemDelete);
app.post("/api/items/:canonicalId/backlog", async (req, res) => {
  const id = decodeURIComponent(req.params.canonicalId);
  const item = itemFromAnyStore(id);
  if (!item) return res.status(404).json({ error: "Item no encontrado." });
  const followedAt = new Date().toISOString();
  const deckExisting = findOnDeckItemByCanonicalId(id);
  if (deckExisting) await onDeckStore.remove(deckExisting.id).catch(() => null);
  await completionStore.removeByCanonicalId(id).catch(() => null);
  const backlogSource = item.source === "plex" || item.source === "playnite" || item.source === "kiosko" ? item.source : "manual";
  const backlogItem = await backlogStore.upsert(backlogSource, { ...item, source: backlogSource, completedAt: null, states: { ...(item.states || {}), completed: false, inBacklog: true, inOnDeck: false }, lastActivityAt: followedAt, updatedAt: followedAt, meta: { ...(item.meta || {}), followedAt, trackingSource: "manual", originalSource: item.source || null } });
  await removeCompletionForCanonicalId(id);
  await itemRegistryStore.upsert({ ...item, completedAt: null, lastActivityAt: followedAt }, { inBacklog: true, inOnDeck: false, completed: false, charred: shouldClearCharred("manual") ? false : item.states?.charred, turnedAt: null, rating: item.rating ?? null, completedAt: null, lastActivityAt: followedAt, activity: { eventType: "manual_follow", title: item.title, subtitle: item.subtitle, activityAt: followedAt } });
  await syncItemRegistryNow("follow-backlog");
  const payload = fullStatePayload({ item: publicItem(backlogItem), backlogItem: publicItem(backlogItem) });
  broadcastDelta("item:backlog-upserted", payload);
  res.json({ ok: true, item: backlogItem });
});
app.delete("/api/items/:canonicalId/backlog", async (req, res) => {
  const id = decodeURIComponent(req.params.canonicalId);
  const item = itemFromAnyStore(id);
  const source = item?.source || "plex";
  const removed = await backlogStore.remove(source, id).catch(async () => {
    const existing = findBacklogItemByCanonicalId(id);
    return existing ? backlogStore.remove(existing.source, existing.id) : null;
  });
  if (!removed) return res.status(404).json({ error: "Item no encontrado en Backlog." });
  const activityAt = new Date().toISOString();
  await itemRegistryStore.upsert({ ...(item || removed), lastActivityAt: activityAt }, { inBacklog: false, turnedAt: null, lastActivityAt: activityAt, activity: { eventType: "manual_unfollow", title: removed.title, subtitle: removed.subtitle, activityAt } });
  await syncItemRegistryNow("unfollow-backlog");
  const payload = fullStatePayload({ source: removed.source, id: removed.id, canonicalId: removed.canonicalId, item: publicItem(removed) });
  broadcastDelta("item:backlog-removed", payload);
  res.json({ ok: true, removed });
});
app.post("/api/items/:canonicalId/deck", async (req, res) => {
  const id = decodeURIComponent(req.params.canonicalId);
  const item = itemFromAnyStore(id);
  if (!item) return res.status(404).json({ error: "Item no encontrado." });
  const activityAt = new Date().toISOString();
  const backlogExisting = findBacklogItemByCanonicalId(id);
  if (backlogExisting) await backlogStore.remove(backlogExisting.source, backlogExisting.id).catch(() => null);
  await completionStore.removeByCanonicalId(id).catch(() => null);
  const deckItem = normalizeDeckItem({ ...item, completedAt: null, states: { ...(item.states || {}), completed: false, inBacklog: false, inOnDeck: true }, lastActivityAt: activityAt, updatedAt: activityAt });
  const check = await enforceDeckLimitOrReplace(deckItem, req.body?.replaceId || "");
  if (!check.ok) return res.status(409).json({ error: "Límite de On Deck alcanzado.", ...check.payload });
  const saved = await onDeckStore.upsert(deckItem);
  await removeCompletionForCanonicalId(id);
  await itemRegistryStore.upsert({ ...item, completedAt: null, lastActivityAt: activityAt }, { inOnDeck: true, inBacklog: false, completed: false, charred: shouldClearCharred("manual") ? false : item.states?.charred, turnedAt: null, rating: item.rating ?? null, completedAt: null, lastActivityAt: activityAt, activity: { eventType: "manual_deck", title: item.title, subtitle: item.subtitle, activityAt } });
  await syncItemRegistryNow("add-deck");
  const payload = fullStatePayload({ from: "database", replaced: check.replaced ? publicItem(check.replaced) : null, deckItem: publicItem(saved) });
  broadcastDelta("item:moved-to-deck", payload);
  res.json({ ok: true, deckItem: saved, replaced: check.replaced || null });
});
app.delete("/api/items/:canonicalId/deck", async (req, res) => {
  const id = decodeURIComponent(req.params.canonicalId);
  const existing = findOnDeckItemByCanonicalId(id);
  if (!existing) return res.status(404).json({ error: "Item no encontrado en On Deck." });
  const removed = await onDeckStore.remove(existing.id);
  const activityAt = new Date().toISOString();
  await itemRegistryStore.upsert({ ...removed, lastActivityAt: activityAt }, { inOnDeck: false, turnedAt: null, lastActivityAt: activityAt, activity: { eventType: "manual_deck_remove", title: removed.title, subtitle: removed.subtitle, activityAt } });
  await syncItemRegistryNow("remove-deck");
  const payload = fullStatePayload({ id: removed.id, canonicalId: removed.canonicalId, item: publicItem(removed) });
  broadcastDelta("item:deck-removed", payload);
  res.json({ ok: true, removed });
});
async function removeCompletionForCanonicalId(id) {
  await completionStore.removeByCanonicalId(id).catch(() => null);
}

app.put("/api/items/:canonicalId/assessment", async (req, res) => {
  try {
    const id = decodeURIComponent(req.params.canonicalId);
    const item = itemFromAnyStore(id);
    if (!item) return res.status(404).json({ error: "Item no encontrado." });
    const ratingRaw = req.body?.rating;
    const rating = ratingRaw === null || ratingRaw === undefined || Number(ratingRaw) <= 0 ? null : Math.max(1, Math.min(5, Number(ratingRaw)));
    const completed = req.body?.completed === true;
    const wasCompleted = Boolean(item.states?.completed || item.completedAt);
    const activityAt = new Date().toISOString();
    let completedAt = completed ? (item.completedAt || activityAt) : null;

    if (completed) {
      const backlogExisting = findBacklogItemByCanonicalId(id);
      if (backlogExisting) await backlogStore.remove(backlogExisting.source, backlogExisting.id).catch(() => null);
      const deckExisting = findOnDeckItemByCanonicalId(id);
      if (deckExisting) await onDeckStore.remove(deckExisting.id).catch(() => null);
      await completionStore.complete({ ...item, rating: rating ?? 0, completedAt });
    } else {
      await removeCompletionForCanonicalId(id);
    }

    const lastActivityAt = completed !== wasCompleted ? activityAt : item.lastActivityAt;
    const updated = await itemRegistryStore.upsert(
      { ...item, rating, completedAt, lastActivityAt },
      { completed, inBacklog: completed ? false : item.states?.inBacklog, inOnDeck: completed ? false : item.states?.inOnDeck, rating, completedAt, lastActivityAt }
    );

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "reviewComment") || req.body?.reviewImageData || req.body?.reviewRemoveImage) {
      const current = journalStore.getReview(id);
      let image = current?.image || null;
      if (req.body?.reviewRemoveImage) image = null;
      else if (req.body?.reviewImageData) image = await saveJournalImage(req.body.reviewImageData, item, "review");
      const comment = String(req.body?.reviewComment ?? current?.comment ?? "").trim();
      if (!comment && !image) await journalStore.removeReview(id);
      else await journalStore.setReview(id, { comment, image });
    }

    await syncItemRegistryNow("assessment-update");
    const finalItem = itemRegistryStore.get(id) || updated;
    const payload = fullStatePayload(journalPayload(finalItem));
    broadcastDelta("item:assessment-updated", payload);
    res.json({ ok: true, ...journalPayload(finalItem) });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.post("/api/items/:canonicalId/complete", async (req, res) => {
  const id = decodeURIComponent(req.params.canonicalId);
  const item = itemFromAnyStore(id);
  if (!item) return res.status(404).json({ error: "Item no encontrado." });
  const rating = req.body?.rating ?? item.rating ?? 0;
  const completed = await completeItem(item, rating);
  const backlogExisting = findBacklogItemByCanonicalId(id);
  if (backlogExisting) await backlogStore.remove(backlogExisting.source, backlogExisting.id).catch(() => null);
  const deckExisting = findOnDeckItemByCanonicalId(id);
  if (deckExisting) await onDeckStore.remove(deckExisting.id).catch(() => null);
  await itemRegistryStore.upsert({ ...item, ...completed, rating, completedAt: completed.completedAt, lastActivityAt: completed.completedAt }, { completed: true, inBacklog: false, inOnDeck: false, rating, completedAt: completed.completedAt, lastActivityAt: completed.completedAt });
  await syncItemRegistryNow("complete-item");
  const payload = fullStatePayload({ from: req.body?.from || "database", completed: publicItem(completed), item: publicItem(completed) });
  broadcastDelta("item:completed", payload);
  res.json({ ok: true, completed });
});
app.delete("/api/items/:canonicalId/collection", async (req, res) => {
  const id = decodeURIComponent(req.params.canonicalId);
  const existing = findCompletionByCanonicalId(id);
  const registryItem = itemRegistryStore.get(id) || itemFromAnyStore(id);
  if (!existing && !registryItem) return res.status(404).json({ error: "Item no encontrado." });
  const removed = existing ? await completionStore.remove(existing.id) : null;
  const canonicalId = removed?.canonicalId || registryItem?.canonicalId || id;
  const reg = itemRegistryStore.get(canonicalId) || registryItem;
  const activityAt = new Date().toISOString();
  let updated = reg;
  if (reg) {
    updated = await itemRegistryStore.upsert(
      { ...reg, completedAt: null, lastActivityAt: activityAt },
      { completed: false, inOnDeck: reg.states?.inOnDeck || false, inBacklog: reg.states?.inBacklog || false, rating: reg.rating ?? null, completedAt: null, lastActivityAt: activityAt }
    );
  }
  await syncItemRegistryNow("remove-collection");
  const finalItem = itemRegistryStore.get(canonicalId) || updated || { ...removed, canonicalId, rating: registryItem?.rating ?? removed?.rating ?? null, completedAt: null };
  const payload = fullStatePayload({ id: removed?.id || null, canonicalId, item: publicGrillItem(finalItem) });
  broadcastDelta("item:completion-removed", payload);
  res.json({ ok: true, removed, item: publicGrillItem(finalItem) });
});
app.post("/api/items/sync", async (_req, res) => {
  const result = await syncItemRegistryNow("manual-api");
  res.json({ ok: true, ...result, diagnostics: itemRegistryStore.diagnostics() });
});


async function saveJournalImage(dataUri, item, label = "diario") {
  if (!dataUri) return null;
  const approxBytes = Math.ceil(String(dataUri).length * 0.75);
  if (approxBytes > 5 * 1024 * 1024) throw new Error("La imagen supera el límite de 5 MB.");
  const asset = await assetService.saveDataUri(dataUri, { bucket: "journals", title: `${item.title || "item"}-${label}` });
  return asset.path;
}
function journalPayload(item) { return { item: publicItem(item), ...journalStore.summary(String(item.canonicalId || item.id)) }; }
app.get("/api/items/:canonicalId/journal", (req, res) => {
  const id = decodeURIComponent(req.params.canonicalId);
  res.json({ ...journalStore.list(id, { page: req.query.page, limit: req.query.limit }), review: journalStore.getReview(id) });
});
app.post("/api/items/:canonicalId/activity", async (req, res) => {
  try {
    const id = decodeURIComponent(req.params.canonicalId); const item = itemFromAnyStore(id);
    if (!item) return res.status(404).json({ error: "Item no encontrado." });
    const activityAt = new Date().toISOString();
    const image = await saveJournalImage(req.body?.imageData, item, "entrada");
    const entry = await journalStore.add(id, { comment: req.body?.comment, image, activityAt });
    const detail = String(req.body?.detail ?? item.detail ?? item.subtitle ?? '');
    const updated = await itemRegistryStore.upsert(
      { ...item, detail, subtitle: detail, lastActivityAt: activityAt },
      { forceSubtitle: true, charred: shouldClearCharred("journal") ? false : item.states?.charred, turnedAt: null, lastActivityAt: activityAt, activity: { eventType: "manual_journal", title: item.title, subtitle: detail, activityAt } }
    );
    await updateManualItemInLegacyStores(updated); await syncItemRegistryNow("journal-activity");
    const payload = fullStatePayload(journalPayload(itemRegistryStore.get(id) || updated)); broadcastDelta("item:journal-updated", payload);
    res.json({ ok: true, entry, ...journalPayload(itemRegistryStore.get(id) || updated) });
  } catch (error) { res.status(400).json({ error: error.message }); }
});
app.patch("/api/items/:canonicalId/journal/:entryId", async (req, res) => {
  try { const id = decodeURIComponent(req.params.canonicalId); const item = itemFromAnyStore(id); if (!item) return res.status(404).json({ error: "Item no encontrado." });
    const image = req.body?.removeImage ? null : (req.body?.imageData ? await saveJournalImage(req.body.imageData, item, "entrada") : undefined);
    const patch = { comment: req.body?.comment }; if (image !== undefined) patch.image = image;
    const entry = await journalStore.update(id, req.params.entryId, patch); if (!entry) return res.status(404).json({ error: "Entrada no encontrada." });
    const payload = fullStatePayload(journalPayload(item)); broadcastDelta("item:journal-updated", payload); res.json({ ok: true, entry, ...journalPayload(item) });
  } catch (error) { res.status(400).json({ error: error.message }); }
});
app.delete("/api/items/:canonicalId/journal/:entryId", async (req, res) => { const id=decodeURIComponent(req.params.canonicalId); const item=itemFromAnyStore(id); const removed=await journalStore.remove(id, req.params.entryId); if(!removed) return res.status(404).json({error:"Entrada no encontrada."}); const payload=fullStatePayload(journalPayload(item||{canonicalId:id})); broadcastDelta("item:journal-updated",payload); res.json({ok:true,removed,...journalPayload(item||{canonicalId:id})}); });
app.put("/api/items/:canonicalId/review", async (req, res) => {
  try { const id=decodeURIComponent(req.params.canonicalId); const item=itemFromAnyStore(id); if(!item) return res.status(404).json({error:"Item no encontrado."}); const current=journalStore.getReview(id); let image=current?.image||null; if(req.body?.removeImage) image=null; else if(req.body?.imageData) image=await saveJournalImage(req.body.imageData,item,"review"); const review=await journalStore.setReview(id,{comment:req.body?.comment,image}); const payload=fullStatePayload(journalPayload(item)); broadcastDelta("item:journal-updated",payload); res.json({ok:true,review,...journalPayload(item)}); } catch(error){res.status(400).json({error:error.message});}
});
app.delete("/api/items/:canonicalId/review", async (req,res)=>{ const id=decodeURIComponent(req.params.canonicalId); const item=itemFromAnyStore(id); const removed=await journalStore.removeReview(id); const payload=fullStatePayload(journalPayload(item||{canonicalId:id})); broadcastDelta("item:journal-updated",payload); res.json({ok:true,removed,...journalPayload(item||{canonicalId:id})}); });

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
  const normalized = input?.canonicalId && input?.source
    ? input
    : (input.source === "playnite" ? normalizePlayniteBacklogItem(input) : normalizePlexBacklogItem(input));
  const item = normalizeDeckItem(normalized);
  if (!item?.canonicalId) return null;
  const existing = onDeckStore.findByCanonicalId(item.canonicalId);
  if (!existing) return null;
  const detail = String(item.detail || item.subtitle || existing.detail || existing.subtitle || "").trim();
  const updated = await onDeckStore.upsert({
    ...existing,
    ...item,
    detail,
    subtitle: detail,
    addedToDeckAt: existing.addedToDeckAt,
    lastActivityAt: item.lastActivityAt || new Date().toISOString()
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
  return completed;
}

function collectionTypeFromEntityType(entityType = "item") {
  const type = String(entityType || "item").toLowerCase();
  if (["game", "games", "juego", "juegos"].includes(type)) return "games";
  if (["movie", "movies", "pelicula", "películas"].includes(type)) return "movies";
  if (["series", "serie", "show", "episode", "season"].includes(type)) return "series";
  return type || "item";
}

function ingestionRepresentsCurrentActivity(envelope = {}) {
  const source = String(envelope.source || "").toLowerCase();
  const eventType = String(envelope.eventType || "").toLowerCase();
  if (source === "playnite") return ["started", "played"].includes(eventType);
  if (source === "plex") return ["play", "played", "start", "started", "playback_start"].includes(eventType);
  return false;
}

async function persistIngestedCurrentActivity(envelope = {}, item = {}) {
  if (!ingestionRepresentsCurrentActivity(envelope)) return null;

  const source = String(envelope.source || item.source || "external").toLowerCase();
  const isPlaynite = source === "playnite";
  const detail = item.detail || item.subtitle || envelope.detail || "";
  const current = {
    source,
    kind: isPlaynite ? "game" : source,
    event: isPlaynite ? "game_started" : envelope.eventType,
    eventType: envelope.eventType,
    canonicalId: item.canonicalId || envelope.canonicalId,
    externalId: envelope.externalId || null,
    title: item.title || envelope.title,
    subtitle: detail,
    detail,
    type: item.type || envelope.entityType,
    collectionType: item.collectionType || collectionTypeFromEntityType(envelope.entityType),
    cover: item.poster || null,
    poster: item.poster || null,
    posterUrl: item.poster || null,
    background: item.backdrop || null,
    backdrop: item.backdrop || null,
    backdropUrl: item.backdrop || null,
    platforms: Array.isArray(envelope.metadata?.platforms) ? envelope.metadata.platforms : [],
    occurredAt: envelope.occurredAt,
    lastActivityAt: envelope.occurredAt
  };

  runtime.currentContent = current;
  const statePatch = { lastCurrent: current };
  if (isPlaynite) {
    runtime.game = current;
    statePatch.lastGame = current;
  } else if (source === "plex") {
    runtime.plex = current;
    statePatch.lastPlex = current;
  }
  await stateStore.update(statePatch);
  return current;
}

async function ingestExternalItem(rawPayload = {}, { integration = "external", broadcast = true } = {}) {
  const envelope = normalizeIngestionPayload(rawPayload);
  const current = itemFromAnyStore(envelope.canonicalId);
  if (!current && !envelope.behavior.createIfMissing) {
    return { ok: true, ignored: true, reason: "item_missing", envelope };
  }

  let incoming = {
    ...(current || {}),
    source: envelope.source,
    canonicalId: envelope.canonicalId,
    type: envelope.entityType,
    collectionType: collectionTypeFromEntityType(envelope.entityType),
    title: envelope.title,
    detail: envelope.behavior.updateDetail ? envelope.detail : (current?.detail || current?.subtitle || ""),
    subtitle: envelope.behavior.updateDetail ? envelope.detail : (current?.detail || current?.subtitle || ""),
    poster: envelope.assets.poster || current?.poster || null,
    backdrop: envelope.assets.backdrop || current?.backdrop || null,
    lastActivityAt: envelope.behavior.updateActivity ? envelope.occurredAt : (current?.lastActivityAt || envelope.occurredAt),
    meta: envelope.behavior.updateMetadata ? { ...(current?.meta || {}), ...envelope.metadata, integration, externalId: envelope.externalId } : (current?.meta || {})
  };
  if (incoming.source === "plex") incoming = canonicalizePlexSeriesItem(incoming);

  const patch = {
    forceSubtitle: envelope.behavior.updateDetail,
    lastActivityAt: incoming.lastActivityAt,
    charred: envelope.behavior.clearCharred ? false : undefined,
    activity: envelope.behavior.updateActivity ? {
      eventType: `${envelope.source}_${envelope.eventType}`,
      title: incoming.title,
      subtitle: incoming.subtitle,
      activityAt: envelope.occurredAt,
      externalKey: `${envelope.source}:${envelope.externalId}:${envelope.eventType}:${envelope.occurredAt}`
    } : undefined
  };
  const updated = await itemRegistryStore.upsert(incoming, patch);

  const backlogItem = findBacklogItemByCanonicalId(updated.canonicalId);
  let savedBacklogItem = null;
  if (backlogItem) {
    savedBacklogItem = await backlogStore.upsert(backlogItem.source || updated.source, {
      ...backlogItem,
      ...updated,
      id: backlogItem.id,
      subtitle: updated.subtitle,
      detail: updated.detail,
      lastActivityAt: updated.lastActivityAt
    });
  }
  const deckItem = findOnDeckItemByCanonicalId(updated.canonicalId);
  let savedDeckItem = null;
  if (deckItem) {
    savedDeckItem = await onDeckStore.upsert({
      ...deckItem,
      ...updated,
      id: deckItem.id,
      subtitle: updated.subtitle,
      detail: updated.detail,
      addedToDeckAt: deckItem.addedToDeckAt,
      lastActivityAt: updated.lastActivityAt
    });
  }

  await syncItemRegistryNow(`ingest:${integration}`);
  const finalItem = publicGrillItem(itemRegistryStore.get(updated.canonicalId) || updated);
  const currentActivity = await persistIngestedCurrentActivity(envelope, finalItem);
  const payload = fullStatePayload({ item: finalItem, backlogItem: savedBacklogItem ? publicItem(savedBacklogItem) : null, deckItem: savedDeckItem ? publicItem(savedDeckItem) : null, currentContent: currentActivity });
  if (broadcast) {
    broadcastDelta(savedBacklogItem ? "item:backlog-upserted" : savedDeckItem ? "item:deck-upserted" : "item:database-updated", payload);
    if (currentActivity) hub.broadcast({ type: "current:update", payload: currentActivity });
    if (envelope.behavior.showToast) {
      hub.broadcast({
        type: "activity:received",
        payload: {
          source: envelope.source,
          eventType: envelope.eventType,
          title: finalItem.title,
          detail: finalItem.detail || finalItem.subtitle || "",
          poster: finalItem.poster || null,
          backdrop: finalItem.backdrop || null,
          canonicalId: finalItem.canonicalId,
          occurredAt: envelope.occurredAt
        }
      });
    }
  }
  return { ok: true, created: !current, item: finalItem, backlogItem: savedBacklogItem ? publicItem(savedBacklogItem) : null, deckItem: savedDeckItem ? publicItem(savedDeckItem) : null, currentContent: currentActivity, toastEmitted: Boolean(broadcast && envelope.behavior.showToast), envelope };
}

function requireExternalApiToken(req, res, next) {
  const expected = String(process.env.BBQUEUE_API_TOKEN || "").trim();
  if (!expected) return next();
  const supplied = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim() || String(req.headers["x-api-key"] || "").trim();
  if (supplied !== expected) return res.status(401).json({ error: "Token de API inválido." });
  next();
}

app.get("/api/v1/ingestion/schema", (_req, res) => res.json({ apiVersion: "1", endpoint: "/api/v1/items/upsert", example: ingestionExample() }));
app.post("/api/v1/items/upsert", requireExternalApiToken, async (req, res) => {
  try { const result = await ingestExternalItem(req.body, { integration: req.body?.source || "external" }); res.status(result.created ? 201 : 200).json(result); }
  catch (error) { res.status(400).json({ error: error.message }); }
});
app.post("/api/v1/events", requireExternalApiToken, async (req, res) => {
  try { const result = await ingestExternalItem(req.body, { integration: req.body?.source || "external" }); res.status(result.created ? 201 : 200).json(result); }
  catch (error) { res.status(400).json({ error: error.message }); }
});

app.delete("/api/backlog/:source/:id", async (req, res) => {
  const started = traceActionStart("backlog.delete", req);
  try {
    const removed = await backlogStore.remove(req.params.source, req.params.id);
    await syncItemRegistryNow("backlog-delete");
    const payload = fullStatePayload({ source: removed.source, id: removed.id, canonicalId: removed.canonicalId, item: publicItem(removed) });
    broadcastDelta("item:backlog-removed", payload);
    traceActionEnd("backlog.delete", started, { bytes: approxBytes(payload) });
    res.json({ ok: true, removed });
  } catch (error) { console.error("[action:error] backlog.delete", error); res.status(404).json({ error: error.message }); }
});
app.post("/api/backlog/:source/:id/deck", async (req, res) => {
  const started = traceActionStart("backlog.to-deck", req);
  try {
    const sourceItems = backlogStore.source(req.params.source);
    const pending = sourceItems.find(item => item.id === req.params.id || item.canonicalId === req.params.id);
    if (!pending) return res.status(404).json({ error: "Item no encontrado en Backlog." });
    const normalizedDeckItem = normalizeDeckItem(pending);
    const limitCheck = await enforceDeckLimitOrReplace(normalizedDeckItem, req.body?.replaceId || "");
    if (!limitCheck.ok) return res.status(409).json({ error: "Límite de On Deck alcanzado.", ...limitCheck.payload });

    const deckItem = await onDeckStore.upsert(normalizedDeckItem);
    traceStep("backlog.to-deck deck upsert", started);
    await syncItemRegistryNow("backlog-to-deck");
    const payload = fullStatePayload({ from: "backlog", replaced: limitCheck.replaced ? publicItem(limitCheck.replaced) : null, deckItem: publicItem(deckItem) });
    broadcastDelta("item:moved-to-deck", payload);
    traceActionEnd("backlog.to-deck", started, { bytes: approxBytes(payload) });
    res.json({ ok: true, deckItem, replaced: limitCheck.replaced || null });
  } catch (error) { console.error("[action:error] backlog.to-deck", error); res.status(400).json({ error: error.message }); }
});
app.post("/api/backlog/:source/:id/complete", async (req, res) => {
  const started = traceActionStart("backlog.complete", req);
  try {
    const sourceItems = backlogStore.source(req.params.source);
    const item = sourceItems.find(entry => entry.id === req.params.id || entry.canonicalId === req.params.id);
    if (!item) return res.status(404).json({ error: "Item no encontrado en Backlog." });
    const completed = await completeItem(item, req.body?.rating ?? 0);
    if (req.body?.removeFromBacklog === true) await backlogStore.remove(req.params.source, req.params.id).catch(() => null);
    if (req.body?.removeFromDeck === true) await onDeckStore.remove(completed.canonicalId).catch(() => null);
    await syncItemRegistryNow("backlog-complete");
    traceStep("backlog.complete completed", started);
    const payload = fullStatePayload({ from: "backlog", item: publicItem(item), completed: publicItem(completed) });
    broadcastDelta("item:completed", payload);
    traceActionEnd("backlog.complete", started, { bytes: approxBytes(payload) });
    res.json({ ok: true, completed });
  } catch (error) { console.error("[action:error] backlog.complete", error); res.status(400).json({ error: error.message }); }
});

app.delete("/api/on-deck/:id", async (req, res) => {
  const started = traceActionStart("deck.delete", req);
  try {
    const removed = await onDeckStore.remove(req.params.id);
    await syncItemRegistryNow("deck-delete");
    const payload = fullStatePayload({ id: removed.id, canonicalId: removed.canonicalId, item: publicItem(removed) });
    broadcastDelta("item:deck-removed", payload);
    traceActionEnd("deck.delete", started, { bytes: approxBytes(payload) });
    res.json({ ok: true, removed });
  } catch (error) { console.error("[action:error] deck.delete", error); res.status(404).json({ error: error.message }); }
});
app.post("/api/on-deck/:id/complete", async (req, res) => {
  const started = traceActionStart("deck.complete", req);
  try {
    const item = onDeckStore.list().find(entry => entry.id === req.params.id || entry.canonicalId === req.params.id);
    if (!item) return res.status(404).json({ error: "Item no encontrado en On Deck." });
    const completed = await completeItem(item, req.body?.rating ?? 0);
    if (req.body?.removeFromDeck === true) await onDeckStore.remove(item.id).catch(() => null);
    await syncItemRegistryNow("deck-complete");
    traceStep("deck.complete completed", started);
    const payload = fullStatePayload({ from: "on-deck", item: publicItem(item), completed: publicItem(completed) });
    broadcastDelta("item:completed", payload);
    traceActionEnd("deck.complete", started, { bytes: approxBytes(payload) });
    res.json({ ok: true, completed });
  } catch (error) { console.error("[action:error] deck.complete", error); res.status(400).json({ error: error.message }); }
});
app.post("/api/on-deck/:id/backlog", async (req, res) => {
  const started = traceActionStart("deck.follow-backlog", req);
  try {
    const item = onDeckStore.list().find(entry => entry.id === req.params.id || entry.canonicalId === req.params.id);
    if (!item) return res.status(404).json({ error: "Item no encontrado en On Deck." });
    const backlogItem = await backlogStore.upsert(item.source, item);
    await syncItemRegistryNow("deck-follow-backlog");
    const payload = fullStatePayload({ from: "on-deck", backlogItem: publicItem(backlogItem), item: publicItem(backlogItem) });
    broadcastDelta("item:moved-to-backlog", payload);
    traceActionEnd("deck.follow-backlog", started, { bytes: approxBytes(payload) });
    res.json({ ok: true, item: backlogItem });
  } catch (error) { console.error("[action:error] deck.follow-backlog", error); res.status(400).json({ error: error.message }); }
});

app.get("/api/completions", (_req, res) => res.json(publicCompletions()));
app.patch("/api/completions/:id", async (req, res) => {
  const started = traceActionStart("completion.update", req);
  try {
    const item = await completionStore.update(req.params.id, req.body || {});
    await syncItemRegistryNow("completion-update");
    const payload = fullStatePayload({ completed: publicItem(item), item: publicItem(item) });
    broadcastDelta("item:completion-updated", payload);
    traceActionEnd("completion.update", started, { bytes: approxBytes(payload) });
    res.json(item);
  } catch (error) { console.error("[action:error] completion.update", error); res.status(404).json({ error: error.message }); }
});
app.delete("/api/completions/:id", async (req, res) => {
  const started = traceActionStart("completion.delete", req);
  try {
    const removed = await completionStore.remove(req.params.id);
    const reg = itemRegistryStore.get(removed.canonicalId);
    if (reg) {
      reg.rating = null;
      reg.completedAt = null;
      reg.states = { ...(reg.states || {}), completed: false };
      reg.status = reg.states.inOnDeck ? "on-deck" : reg.states.inBacklog ? "backlog" : "known";
      reg.updatedAt = new Date().toISOString();
      await itemRegistryStore.persist();
    }
    await syncItemRegistryNow("completion-delete");
    const payload = fullStatePayload({ id: removed.id, canonicalId: removed.canonicalId, item: publicItem({ ...removed, rating: null, completedAt: null }) });
    broadcastDelta("item:completion-removed", payload);
    traceActionEnd("completion.delete", started, { bytes: approxBytes(payload) });
    res.json({ ok: true, removed });
  } catch (error) { console.error("[action:error] completion.delete", error); res.status(404).json({ error: error.message }); }
});

app.post("/api/current/clear", async (_req, res) => {
  runtime.currentContent = null;
  await stateStore.update({ lastCurrent: null });
  hub.broadcast({ type: "current:update", payload: null });
  res.json({ ok: true });
});
app.post("/api/current/deck", async (req, res) => {
  const started = traceActionStart("current.to-deck", req);
  try {
    const item = normalizeCurrentToDeckItem();
    const limitCheck = await enforceDeckLimitOrReplace(item, req.body?.replaceId || "");
    if (!limitCheck.ok) return res.status(409).json({ error: "Límite de On Deck alcanzado.", ...limitCheck.payload });
    const deckItem = await onDeckStore.upsert(item);
    await syncItemRegistryNow("current-to-deck");
    const payload = fullStatePayload({ from: "current", replaced: limitCheck.replaced ? publicItem(limitCheck.replaced) : null, deckItem: publicItem(deckItem) });
    broadcastDelta("item:moved-to-deck", payload);
    traceActionEnd("current.to-deck", started, { bytes: approxBytes(payload) });
    res.json({ ok: true, deckItem });
  } catch (error) { console.error("[action:error] current.to-deck", error); res.status(400).json({ error: error.message }); }
});
app.post("/api/current/complete", async (req, res) => {
  const started = traceActionStart("current.complete", req);
  try {
    const item = normalizeCurrentToDeckItem();
    const completed = await completeItem(item, req.body?.rating ?? 0);
    if (req.body?.removeFromDeck === true) await onDeckStore.remove(completed.canonicalId).catch(() => null);
    await syncItemRegistryNow("current-complete");
    const payload = fullStatePayload({ from: "current", item: publicItem(item), completed: publicItem(completed) });
    broadcastDelta("item:completed", payload);
    traceActionEnd("current.complete", started, { bytes: approxBytes(payload) });
    res.json({ ok: true, completed });
  } catch (error) { console.error("[action:error] current.complete", error); res.status(400).json({ error: error.message }); }
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
    const isActivity = event.isLibraryAdded || event.startsPlayback || event.isWatched;
    let trackedItem = null;
    let savedBacklogItem = null;
    if (isActivity) {
      const isCreatedEpisode = event.isLibraryAdded && (metadata.type || metadata.meta?.plexType) === "episode";
      trackedItem = isCreatedEpisode
        ? normalizePlexCreatedBacklogItem(metadata, event)
        : normalizePlexBacklogItem({
            ...metadata,
            meta: {
              ...(metadata.meta || {}),
              backlogSource: event.isLibraryAdded ? "plex_recently_added" : event.isWatched ? "plex_watched" : "plex_playback",
              tautulliEvent: event.rawEvent
            }
          });
      trackedItem.lastActivityAt = new Date().toISOString();
      trackedItem.subtitle = plexActivityDetail(metadata, event) || trackedItem.subtitle;
      trackedItem.detail = trackedItem.subtitle;
      trackedItem.meta = { ...(trackedItem.meta || {}), activityKind: event.isWatched ? "watched" : event.isLibraryAdded ? "added" : event.startsPlayback ? "played" : "activity" };
      trackedItem = canonicalizePlexSeriesItem(trackedItem);
      const ingestion = await ingestExternalItem({
        source: "plex",
        canonicalId: trackedItem.canonicalId,
        externalId: String(metadata.ratingKey || trackedItem.ratingKey || trackedItem.canonicalId),
        entityType: trackedItem.collectionType || trackedItem.type,
        title: trackedItem.title,
        detail: trackedItem.subtitle,
        eventType: event.isWatched ? "watched" : event.isLibraryAdded ? "added" : "played",
        occurredAt: trackedItem.lastActivityAt,
        assets: { poster: trackedItem.poster, backdrop: trackedItem.backdrop },
        metadata: trackedItem.meta,
        behavior: {
          createIfMissing: true,
          updateMetadata: true,
          updateDetail: true,
          updateActivity: true,
          clearCharred: shouldClearCharred(event.isLibraryAdded ? "plexLibraryAdded" : "plexPlayback")
        }
      }, { integration: "tautulli" });
      trackedItem = ingestion.item;
      savedBacklogItem = ingestion.backlogItem || null;
      console.log("[tautulli] item ingested", { rawEvent: event.rawEvent, canonicalId: trackedItem.canonicalId, title: trackedItem.title });
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
    const playniteItem = { ...normalizePlayniteBacklogItem(game), lastActivityAt: new Date().toISOString() };

    const ingestion = await ingestExternalItem({
      source: "playnite",
      canonicalId: playniteItem.canonicalId,
      externalId: String(playniteItem.gameId || game.gameId || playniteItem.canonicalId),
      entityType: "games",
      title: playniteItem.title,
      detail: playniteItem.subtitle,
      eventType: "started",
      occurredAt: playniteItem.lastActivityAt,
      assets: { poster: playniteItem.poster, backdrop: playniteItem.backdrop },
      metadata: playniteItem.meta,
      behavior: { createIfMissing: true, updateMetadata: true, updateDetail: true, updateActivity: true, clearCharred: shouldClearCharred("playniteStarted") }
    }, { integration: "playnite" });

    console.log("Webhook Playnite recibido", { title: game.title, platforms: game.platforms, hasCover: Boolean(game.cover), hasBackground: Boolean(game.background), payloadBytes: Number(req.headers["content-length"] || 0), persistedAssets: true });
    hub.broadcast({ type: "current:update", payload: runtime.currentContent });
    return res.status(200).json({ ok: true, event: game.event, title: game.title });
  } catch (error) {
    console.error("Error en webhook Playnite:", error);
    return res.status(400).json({ ok: false, error: error.message });
  }
}
app.post("/webhook/playnite", handlePlayniteWebhook);
