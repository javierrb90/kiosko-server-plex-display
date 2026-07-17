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
function normalizeCollectionType(item = {}) {
  if (["games", "movies", "series"].includes(item.collectionType)) return item.collectionType;
  if (item.source === "playnite") return "games";
  if (item.type === "movie") return "movies";
  return "series";
}
function publicMeta(meta = {}) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {};
  const output = { ...meta };
  delete output.raw;
  delete output.payload;
  delete output.response;
  delete output.metadata;
  return output;
}
export function canonicalKeyForRegistryItem(item = {}) {
  if (item.canonicalId) return String(item.canonicalId);
  const source = normalizeSource(item.source);
  if (source === "playnite") return `playnite:${slug(item.gameId || item.meta?.gameId || item.title || item.id)}`;
  if (source === "plex") {
    const type = item.collectionType || (item.type === "movie" ? "movies" : item.type === "episode" ? "episode" : "series");
    const key = item.canonicalRatingKey || item.meta?.canonicalRatingKey || item.ratingKey || item.meta?.ratingKey || item.id || item.title;
    return `plex:${type}:${key ? String(key) : slug(item.title || item.id)}`;
  }
  return `${source}:${slug(item.title || item.id)}`;
}
function parentEntityIdFor(item = {}) {
  if (item.meta?.relatedSeriesCanonicalId) return item.meta.relatedSeriesCanonicalId;
  if (item.meta?.relatedOnDeckCanonicalId) return item.meta.relatedOnDeckCanonicalId;
  if (item.source === "plex" && (item.type === "episode" || item.meta?.plexType === "episode")) {
    const key = item.grandparentRatingKey || item.meta?.grandparentRatingKey || item.canonicalRatingKey || item.meta?.canonicalRatingKey || item.parentRatingKey || item.meta?.parentRatingKey;
    return key ? `plex:series:${key}` : null;
  }
  return null;
}
function normalizeItem(input = {}, existing = {}, statePatch = {}) {
  const date = now();
  const canonicalId = canonicalKeyForRegistryItem(input);
  const source = normalizeSource(input.source || existing.source);
  const collectionType = normalizeCollectionType({ ...existing, ...input, source });
  const meta = publicMeta({ ...(existing.meta || {}), ...(input.meta || {}) });
  const firstSeenAt = existing.firstSeenAt || input.firstSeenAt || input.createdAt || date;
  const lastSeenAt = input.lastSeenAt || input.lastActivityAt || input.updatedAt || date;
  const rating = statePatch.rating ?? input.rating ?? existing.rating ?? null;
  const completedAt = statePatch.completedAt ?? input.completedAt ?? existing.completedAt ?? null;
  const states = {
    inBacklog: Boolean(existing.states?.inBacklog),
    inOnDeck: Boolean(existing.states?.inOnDeck),
    completed: Boolean(existing.states?.completed),
    ...(statePatch.states || {})
  };
  if (statePatch.inBacklog !== undefined) states.inBacklog = Boolean(statePatch.inBacklog);
  if (statePatch.inOnDeck !== undefined) states.inOnDeck = Boolean(statePatch.inOnDeck);
  if (statePatch.completed !== undefined) states.completed = Boolean(statePatch.completed);
  return {
    ...(existing || {}),
    id: existing.id || input.registryId || crypto.randomUUID(),
    canonicalId,
    entityId: input.entityId || existing.entityId || parentEntityIdFor(input) || canonicalId,
    parentEntityId: input.parentEntityId || existing.parentEntityId || parentEntityIdFor(input),
    source,
    type: input.type || existing.type || "item",
    collectionType,
    title: clean(input.title || existing.title || "Sin título") || "Sin título",
    subtitle: clean(input.subtitle || existing.subtitle || ""),
    poster: input.poster ?? input.posterUrl ?? input.cover ?? existing.poster ?? null,
    backdrop: input.backdrop ?? input.backdropUrl ?? input.background ?? existing.backdrop ?? null,
    year: input.year ?? input.releaseYear ?? existing.year ?? "",
    ratingKey: input.ratingKey ?? existing.ratingKey ?? null,
    gameId: input.gameId ?? meta.gameId ?? existing.gameId ?? null,
    rating,
    completedAt,
    states,
    status: states.completed ? "completed" : states.inOnDeck ? "on-deck" : states.inBacklog ? "backlog" : "known",
    firstSeenAt,
    lastSeenAt,
    updatedAt: date,
    deletedAt: statePatch.deletedAt ?? existing.deletedAt ?? null,
    meta
  };
}

export class ItemRegistryStore {
  constructor(dataDir) {
    this.filePath = path.join(dataDir, "items.json");
    this.items = [];
    this.writeQueue = Promise.resolve();
    this.writeTimer = null;
    this.pendingData = null;
    this.lastSyncAt = null;
    this.lastSyncReason = null;
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, "utf8"));
      this.items = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      if (error.code !== "ENOENT") console.error("No se pudo cargar items.json:", error);
    }
  }

  list() { return this.items.filter(item => !item.deletedAt); }
  all() { return this.items; }
  count() { return this.list().length; }
  get(canonicalId) { return this.items.find(item => item.canonicalId === canonicalId && !item.deletedAt); }

  query({ page = 1, limit = 60, search = "", type = "", source = "", status = "", sort = "lastSeenAt", direction = "desc" } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(250, Number(limit) || 60));
    const q = clean(search).toLowerCase();
    let rows = this.list();

    if (type && ["games", "movies", "series"].includes(type)) rows = rows.filter(item => item.collectionType === type);
    if (source) rows = rows.filter(item => item.source === source);
    if (status) rows = rows.filter(item => item.status === status || item.states?.[status] === true);
    if (q) {
      rows = rows.filter(item => [item.title, item.subtitle, item.source, item.type, item.collectionType, item.year].some(value => clean(value).toLowerCase().includes(q)));
    }

    const sortKey = ["title", "source", "type", "collectionType", "rating", "completedAt", "firstSeenAt", "lastSeenAt", "updatedAt"].includes(sort) ? sort : "lastSeenAt";
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

  async upsert(input = {}, statePatch = {}) {
    const canonicalId = canonicalKeyForRegistryItem(input);
    const index = this.items.findIndex(item => item.canonicalId === canonicalId);
    const existing = index >= 0 ? this.items[index] : {};
    const item = normalizeItem(input, existing, statePatch);
    if (index >= 0) this.items[index] = item;
    else this.items.unshift(item);
    await this.persist();
    return item;
  }

  async markDeleted(canonicalId) {
    const item = this.items.find(entry => entry.canonicalId === canonicalId || entry.id === canonicalId);
    if (!item) return null;
    item.deletedAt = now();
    item.updatedAt = now();
    await this.persist();
    return item;
  }

  async syncFromViews({ backlog = {}, onDeck = [], completions = [] } = {}, reason = "manual") {
    const started = Date.now();
    const activeBacklog = new Set();
    const activeDeck = new Set();
    const activeCompleted = new Set();

    const apply = (item, patch) => {
      if (!item) return;
      const canonicalId = canonicalKeyForRegistryItem(item);
      if (patch.inBacklog) activeBacklog.add(canonicalId);
      if (patch.inOnDeck) activeDeck.add(canonicalId);
      if (patch.completed) activeCompleted.add(canonicalId);
      const index = this.items.findIndex(entry => entry.canonicalId === canonicalId);
      const existing = index >= 0 ? this.items[index] : {};
      const next = normalizeItem(item, existing, patch);
      if (index >= 0) this.items[index] = next;
      else this.items.unshift(next);
    };

    for (const item of backlog.plex || []) apply(item, { inBacklog: true });
    for (const item of backlog.playnite || []) apply(item, { inBacklog: true });
    for (const item of onDeck || []) apply(item, { inOnDeck: true });
    for (const item of completions || []) apply(item, { completed: true, rating: item.rating ?? null, completedAt: item.completedAt ?? null });

    for (const item of this.items) {
      if (item.deletedAt) continue;
      item.states = {
        ...(item.states || {}),
        inBacklog: activeBacklog.has(item.canonicalId),
        inOnDeck: activeDeck.has(item.canonicalId),
        completed: activeCompleted.has(item.canonicalId)
      };
      item.status = item.states.completed ? "completed" : item.states.inOnDeck ? "on-deck" : item.states.inBacklog ? "backlog" : "known";
      if (activeBacklog.has(item.canonicalId) || activeDeck.has(item.canonicalId) || activeCompleted.has(item.canonicalId)) item.lastSeenAt = now();
    }

    this.lastSyncAt = now();
    this.lastSyncReason = reason;
    await this.persist();
    return { total: this.count(), ms: Date.now() - started, reason };
  }

  async persist() {
    this.pendingData = this.items;
    if (this.writeTimer) return;
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      const snapshot = this.pendingData;
      this.writeQueue = this.writeQueue.then(async () => {
        const started = Date.now();
        await fs.writeFile(this.filePath, JSON.stringify(snapshot), "utf8");
        const ms = Date.now() - started;
        if (ms > 250) console.warn(`[persist] items.json ${ms}ms`);
      }).catch(error => console.error("[persist] items.json error:", error));
    }, Number(process.env.PERSIST_DEBOUNCE_MS || 350));
  }

  diagnostics() {
    const counts = { total: 0, games: 0, movies: 0, series: 0, backlog: 0, onDeck: 0, completed: 0, known: 0, deleted: 0 };
    for (const item of this.items) {
      if (item.deletedAt) { counts.deleted += 1; continue; }
      counts.total += 1;
      if (counts[item.collectionType] !== undefined) counts[item.collectionType] += 1;
      if (item.states?.inBacklog) counts.backlog += 1;
      if (item.states?.inOnDeck) counts.onDeck += 1;
      if (item.states?.completed) counts.completed += 1;
      if (item.status === "known") counts.known += 1;
    }
    return { counts, lastSyncAt: this.lastSyncAt, lastSyncReason: this.lastSyncReason };
  }
}
