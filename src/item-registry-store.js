import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

function now() { return new Date().toISOString(); }
function clean(value) { return String(value ?? "").trim(); }
function slug(value) {
  return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}
function normalizeSource(value) {
  const source = clean(value).toLowerCase();
  if (["plex", "playnite", "sonarr", "radarr", "arr"].includes(source)) return source;
  return source || "manual";
}
function normalizeTypeSlug(value = "") {
  return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}
function normalizeCollectionType(item = {}) {
  const plexType = item.meta?.plexType || item.type;
  if (item.source === "playnite" || item.kind === "game") return "games";
  if (item.source === "plex" && (plexType === "movie" || item.type === "movie")) return "movies";
  if (item.source === "plex") return "series";
  const custom = normalizeTypeSlug(item.collectionType);
  if (custom) return custom;
  if (plexType === "movie" || item.type === "movie") return "movies";
  return "series";
}
function publicMeta(meta = {}) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {};
  const output = { ...meta };
  delete output.raw;
  delete output.payload;
  delete output.response;
  delete output.metadata;
  delete output.Media;
  delete output.Image;
  return output;
}
function plexSeriesKeyFor(item = {}) {
  const meta = item.meta || {};
  return item.relatedSeriesCanonicalId || meta.relatedSeriesCanonicalId || meta.relatedOnDeckCanonicalId ||
    (item.grandparentRatingKey ? `plex:series:${item.grandparentRatingKey}` : null) ||
    (meta.grandparentRatingKey ? `plex:series:${meta.grandparentRatingKey}` : null) ||
    (item.parentRatingKey && ["episode", "season"].includes(item.type) ? `plex:series:${item.parentRatingKey}` : null) ||
    (meta.parentRatingKey && ["episode", "season"].includes(meta.plexType || item.type) ? `plex:series:${meta.parentRatingKey}` : null) ||
    (item.canonicalRatingKey && ["episode", "season", "show"].includes(item.type) ? `plex:series:${item.canonicalRatingKey}` : null) ||
    (meta.canonicalRatingKey && ["episode", "season", "show"].includes(meta.plexType || item.type) ? `plex:series:${meta.canonicalRatingKey}` : null);
}
export function canonicalKeyForRegistryItem(item = {}) {
  const source = normalizeSource(item.source);
  const plexType = item.meta?.plexType || item.type;
  if (source === "plex") {
    if (item.collectionType === "series" || ["episode", "season", "show"].includes(plexType)) {
      const seriesKey = plexSeriesKeyFor(item);
      if (seriesKey) return seriesKey;
      if (String(item.canonicalId || "").startsWith("plex:series:")) return String(item.canonicalId);
      const key = item.canonicalRatingKey || item.meta?.canonicalRatingKey || item.ratingKey || item.meta?.ratingKey || item.id || item.title;
      return `plex:series:${key ? String(key) : slug(item.title || item.id)}`;
    }
    if (item.canonicalId && !String(item.canonicalId).includes(":episode:")) return String(item.canonicalId);
    const key = item.canonicalRatingKey || item.meta?.canonicalRatingKey || item.ratingKey || item.meta?.ratingKey || item.id || item.title;
    return `plex:movies:${key ? String(key) : slug(item.title || item.id)}`;
  }
  if (source === "playnite") return `playnite:${slug(item.gameId || item.meta?.gameId || item.title || item.id)}`;
  if (item.canonicalId) return String(item.canonicalId);
  return `${source}:${slug(item.title || item.id)}`;
}
function entityIdFor(input = {}, canonicalId = "") {
  if (input.entityId) return input.entityId;
  const seriesKey = plexSeriesKeyFor(input);
  return seriesKey || canonicalId;
}
function activityKey(input = {}, canonicalId = "", eventType = "activity") {
  const meta = input.meta || {};
  return input.activityId || meta.activityId || meta.createdEpisodeRatingKey || meta.originalRatingKey || input.ratingKey || meta.ratingKey || `${eventType}:${canonicalId}:${input.lastActivityAt || input.updatedAt || input.createdAt || now()}`;
}
function normalizeActivity(input = {}, item = {}, patch = {}) {
  const meta = publicMeta({ ...(input.meta || {}), ...(patch.meta || {}) });
  const eventType = patch.eventType || meta.tautulliEvent || meta.backlogSource || input.eventType || input.event || "activity";
  const activityAt = patch.activityAt || input.lastActivityAt || input.updatedAt || input.createdAt || now();
  const externalKey = String(patch.externalKey || activityKey(input, item.canonicalId, eventType));
  return {
    id: patch.id || crypto.randomUUID(),
    externalKey,
    itemCanonicalId: item.canonicalId,
    source: item.source,
    eventType,
    activityAt,
    title: patch.title || meta.createdEpisodeTitle || meta.originalTitle || input.activityTitle || input.title || "Actividad",
    subtitle: patch.subtitle || input.activitySubtitle || input.subtitle || "",
    ratingKey: patch.ratingKey || meta.createdEpisodeRatingKey || meta.originalRatingKey || input.ratingKey || null,
    metadata: meta,
    createdAt: now()
  };
}
function normalizeItem(input = {}, existing = {}, patch = {}) {
  const date = now();
  const source = normalizeSource(input.source || existing.source);
  const canonicalId = patch.canonicalIdOverride || canonicalKeyForRegistryItem({ ...input, source });
  const collectionType = normalizeCollectionType({ ...existing, ...input, source });
  const meta = publicMeta({ ...(existing.metadata || existing.meta || {}), ...(input.metadata || input.meta || {}) });
  const firstSeenAt = patch.firstSeenAt || input.firstSeenAt || existing.firstSeenAt || input.createdAt || date;
  const lastActivityAt = patch.lastActivityAt || input.lastActivityAt || input.lastSeenAt || existing.lastActivityAt || existing.lastSeenAt || input.updatedAt || date;
  const completedAt = patch.completedAt ?? input.completedAt ?? existing.completedAt ?? null;
  const rating = patch.rating ?? input.rating ?? existing.rating ?? null;
  const preserveManualDetail = Boolean(patch.preserveManualDetail && source === "kiosko" && (existing.meta?.manualDetail || existing.metadata?.manualDetail) && !patch.forceSubtitle);
  const incomingDetail = clean(input.detail ?? input.subtitle ?? "");
  const existingDetail = clean(existing.detail ?? existing.subtitle ?? "");
  const incomingActivityTime = Date.parse(input.lastActivityAt || input.lastSeenAt || input.updatedAt || input.createdAt || 0) || 0;
  const existingActivityTime = Date.parse(existing.lastActivityAt || existing.lastSeenAt || existing.updatedAt || existing.createdAt || 0) || 0;
  const effectiveDetail = patch.forceSubtitle
    ? (incomingDetail || existingDetail)
    : preserveManualDetail
      ? existingDetail
      : incomingDetail && incomingActivityTime >= existingActivityTime
        ? incomingDetail
        : (existingDetail || incomingDetail);
  const states = {
    inBacklog: Boolean(existing.states?.inBacklog),
    inOnDeck: Boolean(existing.states?.inOnDeck),
    completed: Boolean(existing.states?.completed),
    charred: Boolean(existing.states?.charred),
    turnedAt: existing.states?.turnedAt || null,
    ...(patch.states || {})
  };
  if (patch.inBacklog !== undefined) states.inBacklog = Boolean(patch.inBacklog);
  if (patch.inOnDeck !== undefined) states.inOnDeck = Boolean(patch.inOnDeck);
  if (patch.completed !== undefined) states.completed = Boolean(patch.completed);
  if (patch.charred !== undefined) states.charred = Boolean(patch.charred);
  if (patch.turnedAt !== undefined) states.turnedAt = patch.turnedAt || null;
  if (completedAt) states.completed = true;
  if (states.completed) states.charred = false;
  if (states.charred) { states.inBacklog = false; states.inOnDeck = false; states.completed = false; }
  return {
    ...(existing || {}),
    id: existing.id || input.registryId || input.id || crypto.randomUUID(),
    canonicalId,
    entityId: entityIdFor(input, canonicalId),
    parentEntityId: plexSeriesKeyFor(input) && plexSeriesKeyFor(input) !== canonicalId ? plexSeriesKeyFor(input) : (existing.parentEntityId || null),
    source,
    type: collectionType === "series" ? "series" : (input.type || existing.type || "item"),
    collectionType,
    title: clean(input.meta?.grandparentTitle || input.showTitle || input.title || existing.title || "Sin título") || "Sin título",
    detail: effectiveDetail,
    subtitle: effectiveDetail,
    poster: input.poster ?? input.posterUrl ?? input.cover ?? existing.poster ?? null,
    backdrop: input.backdrop ?? input.backdropUrl ?? input.background ?? existing.backdrop ?? null,
    year: input.year ?? input.releaseYear ?? existing.year ?? "",
    ratingKey: input.ratingKey ?? existing.ratingKey ?? null,
    gameId: input.gameId ?? meta.gameId ?? existing.gameId ?? null,
    rating,
    firstSeenAt,
    lastActivityAt,
    completedAt,
    states,
    status: states.charred ? "charred" : states.completed ? "completed" : states.inOnDeck ? "on-deck" : states.inBacklog ? "backlog" : "known",
    latestActivityId: patch.latestActivityId || existing.latestActivityId || null,
    updatedAt: date,
    deletedAt: patch.deletedAt ?? existing.deletedAt ?? null,
    metadata: meta,
    meta
  };
}

export class ItemRegistryStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.itemsPath = path.join(dataDir, "items.json");
    this.activityPath = path.join(dataDir, "item-activity.json");
    this.backlogEntriesPath = path.join(dataDir, "backlog-entries.json");
    this.items = [];
    this.activity = [];
    this.backlogEntries = [];
    this.writeQueue = Promise.resolve();
    this.writeTimer = null;
    this.pending = null;
    this.lastSyncAt = null;
    this.lastSyncReason = null;
  }

  async init() {
    await fs.mkdir(this.dataDir, { recursive: true });
    this.items = await this.readItems();
    this.activity = await this.readArrayFile(this.activityPath, "activity");
    this.backlogEntries = await this.readArrayFile(this.backlogEntriesPath, "entries");
  }

  async readItems() {
    try {
      const parsed = JSON.parse(await fs.readFile(this.itemsPath, "utf8"));
      const rows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.items) ? parsed.items : []);
      return rows.map(row => normalizeItem(row, row, { states: row.states || {} }));
    } catch (error) {
      if (error.code !== "ENOENT") console.error("No se pudo cargar items.json:", error);
      return [];
    }
  }
  async readArrayFile(filePath, key) {
    try {
      const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
      return Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.[key]) ? parsed[key] : []);
    } catch (error) {
      if (error.code !== "ENOENT") console.error(`No se pudo cargar ${path.basename(filePath)}:`, error);
      return [];
    }
  }

  list() { return this.items.filter(item => !item.deletedAt); }
  all() { return this.items; }
  count() { return this.list().length; }
  get(id) { return this.items.find(item => (item.canonicalId === id || item.id === id) && !item.deletedAt); }

  query({ page = 1, limit = 60, search = "", type = "", source = "", status = "", sort = "lastActivityAt", direction = "desc", view = "" } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(5000, Number(limit) || 60));
    const q = clean(search).toLowerCase();
    const typeSet = new Set(String(type || "").split(",").map(clean).filter(Boolean));
    let rows = this.list();
    if (view === "backlog") rows = rows.filter(item => item.states?.inBacklog === true);
    else if (view === "on-deck") rows = rows.filter(item => item.states?.inOnDeck === true);
    else if (view === "collections") rows = rows.filter(item => item.states?.completed === true || item.rating || item.completedAt);
    if (type === "__none__") rows = [];
    else if (typeSet.size) rows = rows.filter(item => typeSet.has(item.collectionType));
    if (source) rows = rows.filter(item => item.source === source);
    if (status) rows = rows.filter(item => item.status === status || item.states?.[status] === true);
    if (q) rows = rows.filter(item => [item.title, item.subtitle, item.source, item.type, item.collectionType, item.year].some(value => clean(value).toLowerCase().includes(q)));
    const sortKey = ["title", "source", "type", "collectionType", "rating", "completedAt", "firstSeenAt", "lastActivityAt", "updatedAt"].includes(sort) ? sort : "lastActivityAt";
    const dir = direction === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (sortKey === "rating") return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / safeLimit));
    const offset = (safePage - 1) * safeLimit;
    return { items: rows.slice(offset, offset + safeLimit), total, page: safePage, limit: safeLimit, pages };
  }

  async addActivity(input = {}, item = null, patch = {}) {
    const target = item || await this.upsert(input, {});
    const activity = normalizeActivity(input, target, patch);
    const existing = this.activity.find(entry => entry.externalKey === activity.externalKey && entry.itemCanonicalId === activity.itemCanonicalId);
    if (existing) return existing;
    this.activity.unshift(activity);
    target.latestActivityId = activity.id;
    if (!target.lastActivityAt || Date.parse(activity.activityAt) >= Date.parse(target.lastActivityAt || 0)) target.lastActivityAt = activity.activityAt;
    target.updatedAt = now();
    await this.persist();
    return activity;
  }

  async addBacklogEntry(item, activity = null, reason = "recent") {
    if (!item?.canonicalId) return null;
    const key = activity?.id || `${reason}:${item.canonicalId}`;
    const existing = this.backlogEntries.find(entry => entry.itemCanonicalId === item.canonicalId && entry.activityId === key && !entry.dismissedAt);
    if (existing) return existing;
    const entry = { id: crypto.randomUUID(), itemCanonicalId: item.canonicalId, activityId: key, reason, createdAt: now(), dismissedAt: null };
    this.backlogEntries.unshift(entry);
    await this.persist();
    return entry;
  }

  async upsert(input = {}, patch = {}) {
    const canonicalId = canonicalKeyForRegistryItem(input);
    let index = this.items.findIndex(item => item.canonicalId === canonicalId);
    if (index < 0 && normalizeSource(input.source) === "plex" && normalizeCollectionType(input) === "series") {
      const identityKeys = value => new Set([
        value.canonicalRatingKey, value.ratingKey, value.grandparentRatingKey, value.parentRatingKey,
        value.meta?.canonicalRatingKey, value.meta?.ratingKey, value.meta?.grandparentRatingKey, value.meta?.parentRatingKey,
        value.meta?.originalRatingKey, value.meta?.createdEpisodeRatingKey
      ].filter(Boolean).map(String));
      const incomingKeys = identityKeys(input);
      index = this.items.findIndex(candidate => {
        if (candidate.deletedAt || candidate.source !== "plex" || candidate.collectionType !== "series") return false;
        const candidateKeys = identityKeys(candidate);
        return [...incomingKeys].some(key => candidateKeys.has(key));
      });
    }
    const existing = index >= 0 ? this.items[index] : {};
    const item = normalizeItem(input, existing, index >= 0 && existing.canonicalId !== canonicalId ? { ...patch, canonicalIdOverride: existing.canonicalId } : patch);
    if (index >= 0) this.items[index] = item;
    else this.items.unshift(item);
    if (patch.activity || input.meta?.createdFromTautulli || input.meta?.tautulliEvent || input.lastActivityAt) {
      const activity = await this.addActivity(input, item, patch.activity || {});
      item.latestActivityId = activity.id;
      if (patch.inBacklog) await this.addBacklogEntry(item, activity, activity.eventType || "recent");
    }
    await this.persist();
    return item;
  }

  async updateDates(id, patch = {}) {
    const item = this.get(id);
    if (!item) return null;
    const beforeSubtitle = item.detail || item.subtitle || "";
    for (const key of ["firstSeenAt", "lastActivityAt", "completedAt"]) {
      if (patch[key] !== undefined) item[key] = patch[key] || null;
    }
    if (patch.subtitle !== undefined) {
      item.detail = clean(patch.subtitle);
      item.subtitle = item.detail;
      item.meta = { ...(item.meta || {}), manualDetail: true };
      item.metadata = { ...(item.metadata || {}), manualDetail: true };
      if (item.subtitle !== beforeSubtitle) item.lastActivityAt = now();
    }
    if (item.completedAt) item.states = { ...(item.states || {}), completed: true };
    else if (patch.completedAt !== undefined) item.states = { ...(item.states || {}), completed: false };
    item.status = item.states?.completed ? "completed" : item.states?.inOnDeck ? "on-deck" : item.states?.inBacklog ? "backlog" : "known";
    item.updatedAt = now();
    await this.addActivity({ ...item, eventType: patch.subtitle !== undefined ? "manual_detail_edit" : "manual_dates_edit" }, item, { eventType: patch.subtitle !== undefined ? "manual_detail_edit" : "manual_dates_edit", title: patch.subtitle !== undefined ? "Detalle editado" : "Fechas editadas", subtitle: item.subtitle, activityAt: item.lastActivityAt || now() });
    await this.persist();
    return item;
  }

  async markDeleted(id) { return this.deletePermanent(id, { softOnly: true }); }

  async deletePermanent(id, { softOnly = false } = {}) {
    const index = this.items.findIndex(item => item.canonicalId === id || item.id === id);
    if (index < 0) return null;
    const [removed] = softOnly ? [this.items[index]] : this.items.splice(index, 1);
    if (softOnly) {
      removed.deletedAt = now();
      removed.updatedAt = now();
    } else {
      this.activity = this.activity.filter(entry => entry.itemCanonicalId !== removed.canonicalId);
      this.backlogEntries = this.backlogEntries.filter(entry => entry.itemCanonicalId !== removed.canonicalId);
    }
    await this.persist();
    return removed;
  }

  async syncFromViews({ backlog = {}, onDeck = [], completions = [] } = {}, reason = "manual") {
    const started = Date.now();
    const activeBacklog = new Set();
    const activeDeck = new Set();
    const activeCompleted = new Set();
    const apply = async (item, patch) => {
      if (!item) return;
      const canonicalId = canonicalKeyForRegistryItem(item);
      if (patch.inBacklog) activeBacklog.add(canonicalId);
      if (patch.inOnDeck) activeDeck.add(canonicalId);
      if (patch.completed) activeCompleted.add(canonicalId);
      const saved = await this.upsert(item, patch);
      if (patch.inBacklog) await this.addBacklogEntry(saved, null, item.meta?.backlogSource || "recent");
    };
    for (const [source, rows] of Object.entries(backlog || {})) {
      for (const item of Array.isArray(rows) ? rows : []) {
        const eventType = source === "playnite" ? "playnite_recent" : source === "plex" ? (item.meta?.tautulliEvent || item.meta?.backlogSource || "backlog_recent") : "manual_follow";
        await apply(item, { inBacklog: true, preserveManualDetail: item.source === 'kiosko', activity: { eventType, title: item.meta?.createdEpisodeTitle || item.title, subtitle: item.subtitle } });
      }
    }
    for (const item of onDeck || []) await apply(item, { inOnDeck: true, preserveManualDetail: item.source === 'kiosko' });
    for (const item of completions || []) await apply(item, { completed: true, preserveManualDetail: item.source === 'kiosko', rating: item.rating ?? null, completedAt: item.completedAt ?? null });
    for (const item of this.items) {
      if (item.deletedAt) continue;
      item.states = { ...(item.states || {}), inBacklog: activeBacklog.has(item.canonicalId), inOnDeck: activeDeck.has(item.canonicalId), completed: activeCompleted.has(item.canonicalId) || Boolean(item.completedAt) };
      item.status = item.states.completed ? "completed" : item.states.inOnDeck ? "on-deck" : item.states.inBacklog ? "backlog" : "known";
      item.updatedAt = now();
    }
    this.lastSyncAt = now();
    this.lastSyncReason = reason;
    await this.persist();
    return { total: this.count(), ms: Date.now() - started, reason };
  }

  async persist() {
    this.pending = {
      items: { schemaVersion: 2, items: this.items },
      activity: { schemaVersion: 1, activity: this.activity.slice(0, 1000) },
      backlogEntries: { schemaVersion: 1, entries: this.backlogEntries.slice(0, 500) }
    };
    if (this.writeTimer) return;
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      const snapshot = this.pending;
      this.writeQueue = this.writeQueue.then(async () => {
        await fs.writeFile(this.itemsPath, JSON.stringify(snapshot.items), "utf8");
        await fs.writeFile(this.activityPath, JSON.stringify(snapshot.activity), "utf8");
        await fs.writeFile(this.backlogEntriesPath, JSON.stringify(snapshot.backlogEntries), "utf8");
      }).catch(error => console.error("[persist] item database error:", error));
    }, Number(process.env.PERSIST_DEBOUNCE_MS || 350));
  }

  diagnostics() {
    const counts = { total: 0, games: 0, movies: 0, series: 0, backlog: 0, onDeck: 0, completed: 0, known: 0, deleted: 0, activity: this.activity.length, backlogEntries: this.backlogEntries.filter(entry => !entry.dismissedAt).length };
    for (const item of this.items) {
      if (item.deletedAt) { counts.deleted += 1; continue; }
      counts.total += 1;
      if (counts[item.collectionType] !== undefined) counts[item.collectionType] += 1;
      if (item.states?.inBacklog) counts.backlog += 1;
      if (item.states?.inOnDeck) counts.onDeck += 1;
      if (item.states?.completed) counts.completed += 1;
      if (item.status === "known") counts.known += 1;
    }
    return { schema: "json-database-core-v2", counts, lastSyncAt: this.lastSyncAt, lastSyncReason: this.lastSyncReason };
  }
}
