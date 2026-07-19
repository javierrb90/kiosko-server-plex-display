import path from "node:path";
import crypto from "node:crypto";
import { SqliteDatabase } from "./database/sqlite-database.js";

function now() { return new Date().toISOString(); }

function scrubEmbeddedDataUris(value) {
  if (typeof value === "string") return /^data:(?:image|video)\//i.test(value) ? null : value;
  if (Array.isArray(value)) return value.map(scrubEmbeddedDataUris).filter(value => value !== null);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, scrubEmbeddedDataUris(entry)]).filter(([, entry]) => entry !== null));
}

function databaseAssetReference(value) {
  const text = value == null ? null : String(value);
  return text && /^data:(?:image|video)\//i.test(text) ? null : text;
}
function safeJson(value, fallback = {}) { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } }
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
    if (item.collectionType === "movies") {
      if (item.canonicalId && String(item.canonicalId).startsWith("plex:movies:")) return String(item.canonicalId);
      const key = item.canonicalRatingKey || item.meta?.canonicalRatingKey || item.ratingKey || item.meta?.ratingKey || item.id || item.title;
      return `plex:movies:${key ? String(key) : slug(item.title || item.id)}`;
    }
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
  const completedAt = Object.prototype.hasOwnProperty.call(patch, "completedAt")
    ? patch.completedAt
    : Object.prototype.hasOwnProperty.call(input, "completedAt")
      ? input.completedAt
      : (existing.completedAt ?? null);
  const rating = Object.prototype.hasOwnProperty.call(patch, "rating")
    ? patch.rating
    : Object.prototype.hasOwnProperty.call(input, "rating")
      ? input.rating
      : (existing.rating ?? null);
  const preserveManualDetail = Boolean(patch.preserveManualDetail && source === "kiosko" && (existing.meta?.manualDetail || existing.metadata?.manualDetail) && !patch.forceSubtitle);
  const hasDetail = Object.prototype.hasOwnProperty.call(input, "detail") || Object.prototype.hasOwnProperty.call(input, "subtitle");
  const hasContext = Object.prototype.hasOwnProperty.call(input, "context");
  const hasSubtype = Object.prototype.hasOwnProperty.call(input, "subtype");
  const incomingDetail = clean(input.detail ?? input.subtitle ?? "");
  const existingDetail = clean(existing.detail ?? existing.subtitle ?? "");
  const context = hasContext ? clean(input.context) : clean(existing.context);
  const subtype = hasSubtype ? clean(input.subtype) : clean(existing.subtype);
  const incomingActivityTime = Date.parse(input.lastActivityAt || input.lastSeenAt || input.updatedAt || input.createdAt || 0) || 0;
  const existingActivityTime = Date.parse(existing.lastActivityAt || existing.lastSeenAt || existing.updatedAt || existing.createdAt || 0) || 0;
  const effectiveDetail = patch.forceSubtitle
    ? (hasDetail ? incomingDetail : existingDetail)
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
  const authoritativePlexType = source === "plex" ? String(meta.plexType || input.type || "").toLowerCase() : "";
  const resolvedType = authoritativePlexType === "movie"
    ? "movie"
    : ["episode", "season", "show"].includes(authoritativePlexType)
      ? "series"
      : collectionType === "series"
        ? "series"
        : (input.type || existing.type || "item");
  if (authoritativePlexType === "movie") {
    for (const key of ["grandparentTitle", "showTitle", "showPoster", "showBackdrop", "grandparentRatingKey", "parentRatingKey"]) delete meta[key];
  }
  return {
    ...(existing || {}),
    id: existing.id || input.registryId || crypto.randomUUID(),
    canonicalId,
    entityId: entityIdFor(input, canonicalId),
    parentEntityId: plexSeriesKeyFor(input) && plexSeriesKeyFor(input) !== canonicalId ? plexSeriesKeyFor(input) : (existing.parentEntityId || null),
    source,
    type: resolvedType,
    collectionType,
    title: clean(input.meta?.grandparentTitle || input.showTitle || input.title || existing.title || "Sin título") || "Sin título",
    subtype: subtype || null,
    context: context || null,
    detail: hasDetail ? effectiveDetail : existingDetail,
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
    status: states.completed ? "completed" : states.inOnDeck ? "on-deck" : states.inBacklog ? "backlog" : states.charred ? "charred" : "known",
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
    this.sqlite = new SqliteDatabase(dataDir);
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
    this.sqlite.init();
    this.loadFromSqlite();
  }

  loadFromSqlite() {
    const db = this.sqlite.db;
    this.items = db.prepare("SELECT * FROM items ORDER BY COALESCE(last_activity_at, updated_at) DESC").all().map(row => ({
      id: row.id,
      canonicalId: row.canonical_id,
      entityId: row.entity_id,
      parentEntityId: row.parent_entity_id,
      source: row.source,
      type: row.type,
      collectionType: row.collection_type,
      title: row.title,
      subtype: row.subtype || null,
      context: row.context || null,
      detail: row.detail || "",
      subtitle: row.detail || "",
      poster: row.poster,
      backdrop: row.backdrop,
      year: row.year || "",
      ratingKey: row.rating_key,
      gameId: row.game_id,
      rating: row.rating,
      firstSeenAt: row.first_seen_at,
      lastActivityAt: row.last_activity_at,
      completedAt: row.completed_at,
      states: {
        inBacklog: Boolean(row.in_backlog),
        inOnDeck: Boolean(row.in_on_deck),
        completed: Boolean(row.completed),
        charred: Boolean(row.charred),
        turnedAt: row.turned_at || null
      },
      status: row.status,
      latestActivityId: row.latest_activity_id,
      updatedAt: row.updated_at,
      createdAt: row.created_at,
      deletedAt: row.deleted_at,
      metadata: safeJson(row.metadata_json),
      meta: safeJson(row.metadata_json)
    }));
    this.activity = db.prepare("SELECT * FROM activities ORDER BY activity_at DESC LIMIT 1000").all().map(row => ({
      id: row.id,
      externalKey: row.external_key,
      itemCanonicalId: row.item_canonical_id,
      source: row.source,
      eventType: row.event_type,
      activityAt: row.activity_at,
      title: row.title || "",
      subtitle: row.subtitle || "",
      ratingKey: row.rating_key,
      metadata: safeJson(row.metadata_json),
      createdAt: row.created_at
    }));
    this.backlogEntries = db.prepare("SELECT * FROM backlog_entries ORDER BY created_at DESC LIMIT 500").all().map(row => ({
      id: row.id,
      itemCanonicalId: row.item_canonical_id,
      activityId: row.activity_id,
      reason: row.reason,
      createdAt: row.created_at,
      dismissedAt: row.dismissed_at
    }));
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
    else if (view === "collections") rows = rows.filter(item => item.states?.completed === true || Boolean(item.completedAt));
    if (type === "__none__") rows = [];
    else if (typeSet.size) rows = rows.filter(item => typeSet.has(item.collectionType));
    if (source) rows = rows.filter(item => item.source === source);
    if (status) rows = rows.filter(item => item.status === status || item.states?.[status] === true);
    if (q) rows = rows.filter(item => [item.title, item.subtitle, item.subtype, item.context, item.source, item.type, item.collectionType, item.year].some(value => clean(value).toLowerCase().includes(q)));
    const sortKey = ["title", "source", "type", "collectionType", "subtype", "context", "rating", "completedAt", "firstSeenAt", "lastActivityAt", "updatedAt"].includes(sort) ? sort : "lastActivityAt";
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

  plexIdentityKeys(value = {}) {
    return new Set([
      value.canonicalRatingKey, value.ratingKey, value.grandparentRatingKey, value.parentRatingKey,
      value.meta?.canonicalRatingKey, value.meta?.ratingKey, value.meta?.grandparentRatingKey, value.meta?.parentRatingKey,
      value.meta?.originalRatingKey, value.meta?.createdEpisodeRatingKey,
      /^plex:[^:]+:(.+)$/.exec(String(value.canonicalId || ""))?.[1]
    ].filter(Boolean).map(String));
  }

  findEquivalentPlexIndex(input = {}) {
    if (normalizeSource(input.source) !== "plex") return -1;
    const incomingKeys = this.plexIdentityKeys(input);
    if (!incomingKeys.size) return -1;
    return this.items.findIndex(candidate => {
      if (candidate.deletedAt || candidate.source !== "plex") return false;
      const candidateKeys = this.plexIdentityKeys(candidate);
      return [...incomingKeys].some(key => candidateKeys.has(key));
    });
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
    if (index < 0) index = this.findEquivalentPlexIndex(input);
    const existing = index >= 0 ? this.items[index] : {};
    const previousCanonicalId = existing.canonicalId || null;
    const item = normalizeItem(input, existing, patch);
    if (index >= 0) this.items[index] = item;
    else this.items.unshift(item);
    if (previousCanonicalId && previousCanonicalId !== item.canonicalId) {
      for (const entry of this.activity) if (entry.itemCanonicalId === previousCanonicalId) entry.itemCanonicalId = item.canonicalId;
      for (const entry of this.backlogEntries) if (entry.itemCanonicalId === previousCanonicalId) entry.itemCanonicalId = item.canonicalId;
    }
    const equivalentKeys = this.plexIdentityKeys(item);
    if (item.source === "plex" && equivalentKeys.size) {
      this.items = this.items.filter(candidate => {
        if (candidate === item || candidate.source !== "plex") return true;
        const candidateKeys = this.plexIdentityKeys(candidate);
        return ![...equivalentKeys].some(key => candidateKeys.has(key));
      });
    }
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
    if (patch.subtype !== undefined) item.subtype = clean(patch.subtype) || null;
    if (patch.context !== undefined) item.context = clean(patch.context) || null;
    if (patch.subtitle !== undefined) {
      item.detail = clean(patch.subtitle);
      item.subtitle = item.detail;
      item.meta = { ...(item.meta || {}), manualDetail: true };
      item.metadata = { ...(item.metadata || {}), manualDetail: true };
      if (item.subtitle !== beforeSubtitle && patch.lastActivityAt === undefined) item.lastActivityAt = now();
    }
    if (item.completedAt) item.states = { ...(item.states || {}), completed: true };
    else if (patch.completedAt !== undefined) item.states = { ...(item.states || {}), completed: false };
    item.status = item.states?.completed ? "completed" : item.states?.inOnDeck ? "on-deck" : item.states?.inBacklog ? "backlog" : "known";
    item.updatedAt = now();
    const classificationChanged = patch.subtype !== undefined || patch.context !== undefined;
    const eventType = patch.subtitle !== undefined ? "manual_detail_edit" : classificationChanged ? "manual_classification_edit" : "manual_dates_edit";
    await this.addActivity({ ...item, eventType }, item, { eventType, title: patch.subtitle !== undefined ? "Detalle editado" : classificationChanged ? "Clasificación editada" : "Fechas editadas", subtitle: item.subtitle, activityAt: item.lastActivityAt || now() });
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
    const identityToken = item => {
      if (item?.source === "plex") {
        const keys = [...this.plexIdentityKeys(item)];
        if (keys.length) return `plex:${keys.sort()[0]}`;
      }
      return String(item?.canonicalId || canonicalKeyForRegistryItem(item));
    };
    const apply = async (item, patch) => {
      if (!item) return;
      const saved = await this.upsert(item, patch);
      const token = identityToken(saved);
      if (patch.inBacklog) activeBacklog.add(token);
      if (patch.inOnDeck) activeDeck.add(token);
      if (patch.completed) activeCompleted.add(token);
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
      const token = identityToken(item);
      const completed = activeCompleted.has(token) || Boolean(item.completedAt);
      const inOnDeck = !completed && activeDeck.has(token);
      const inBacklog = !completed && !inOnDeck && activeBacklog.has(token);
      item.states = { ...(item.states || {}), inBacklog, inOnDeck, completed };
      item.status = completed ? "completed" : inOnDeck ? "on-deck" : inBacklog ? "backlog" : "known";
      item.updatedAt = now();
    }
    this.lastSyncAt = now();
    this.lastSyncReason = reason;
    await this.persist();
    return { total: this.count(), ms: Date.now() - started, reason };
  }

  ensureUniqueInternalIds() {
    const usedIds = new Set();
    const usedCanonicalIds = new Set();
    const existingRows = this.sqlite.db.prepare("SELECT id, canonical_id FROM items").all();
    const existingIdByCanonical = new Map(existingRows.map(row => [String(row.canonical_id), String(row.id)]));
    const normalized = [];
    for (const item of this.items) {
      if (!item?.canonicalId || usedCanonicalIds.has(item.canonicalId)) continue;
      usedCanonicalIds.add(item.canonicalId);

      // SQLite owns the internal identity. Existing canonical records keep the
      // id already stored in the database; genuinely new records always get a
      // fresh UUID. This prevents external/view ids from colliding with rows
      // that are still present when the synchronization transaction begins.
      let internalId = existingIdByCanonical.get(String(item.canonicalId)) || null;
      if (!internalId || usedIds.has(internalId)) {
        do { internalId = crypto.randomUUID(); } while (usedIds.has(internalId));
      }
      usedIds.add(internalId);
      item.id = internalId;
      normalized.push(item);
    }
    this.items = normalized;
  }

  async persist() {
    // `id` is an internal SQLite identity. Inputs imported from views and
    // integrations may carry their own `id`, so repair collisions before the
    // transaction instead of allowing one malformed legacy row to stop boot.
    this.ensureUniqueInternalIds();
    const items = this.items;
    const activity = this.activity.slice(0, 1000);
    const backlogEntries = this.backlogEntries.slice(0, 500);
    this.sqlite.transaction(() => {
      const db = this.sqlite.db;
      const upsertItem = db.prepare(`
        INSERT INTO items (
          id, canonical_id, entity_id, parent_entity_id, source, type, collection_type, title, subtype, context, detail,
          poster, backdrop, year, rating_key, game_id, rating, first_seen_at, last_activity_at,
          completed_at, status, in_backlog, in_on_deck, completed, charred, turned_at,
          latest_activity_id, metadata_json, created_at, updated_at, deleted_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(canonical_id) DO UPDATE SET
          entity_id=excluded.entity_id, parent_entity_id=excluded.parent_entity_id,
          source=excluded.source, type=excluded.type, collection_type=excluded.collection_type,
          title=excluded.title, subtype=excluded.subtype, context=excluded.context, detail=excluded.detail, poster=excluded.poster, backdrop=excluded.backdrop,
          year=excluded.year, rating_key=excluded.rating_key, game_id=excluded.game_id, rating=excluded.rating,
          first_seen_at=excluded.first_seen_at, last_activity_at=excluded.last_activity_at,
          completed_at=excluded.completed_at, status=excluded.status, in_backlog=excluded.in_backlog,
          in_on_deck=excluded.in_on_deck, completed=excluded.completed, charred=excluded.charred,
          turned_at=excluded.turned_at, latest_activity_id=excluded.latest_activity_id,
          metadata_json=excluded.metadata_json, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at
      `);
      const seenItems = items.map(item => item.canonicalId);

      // Remove dependent snapshots and obsolete item rows before inserting the
      // current authoritative set. Deleting stale rows first releases any old
      // primary-key values that could otherwise collide with a new item.
      db.exec("DELETE FROM activities");
      db.exec("DELETE FROM backlog_entries");
      if (seenItems.length === 0) db.exec("DELETE FROM items");
      else {
        const placeholders = seenItems.map(() => "?").join(",");
        db.prepare(`DELETE FROM items WHERE canonical_id NOT IN (${placeholders})`).run(...seenItems);
      }

      for (const item of items) {
        upsertItem.run(
          item.id, item.canonicalId, item.entityId || null, item.parentEntityId || null,
          item.source || "manual", item.type || "item", item.collectionType || "series", item.title || "Sin título",
          item.subtype || null, item.context || null, item.detail ?? item.subtitle ?? "", databaseAssetReference(item.poster), databaseAssetReference(item.backdrop), String(item.year || ""),
          item.ratingKey == null ? null : String(item.ratingKey), item.gameId == null ? null : String(item.gameId),
          item.rating == null ? null : Number(item.rating), item.firstSeenAt || null, item.lastActivityAt || null,
          item.completedAt || null, item.status || "known", item.states?.inBacklog ? 1 : 0,
          item.states?.inOnDeck ? 1 : 0, item.states?.completed ? 1 : 0, item.states?.charred ? 1 : 0,
          item.states?.turnedAt || null, item.latestActivityId || null,
          JSON.stringify(scrubEmbeddedDataUris(item.metadata || item.meta || {})), item.createdAt || item.firstSeenAt || item.updatedAt || now(),
          item.updatedAt || now(), item.deletedAt || null
        );
      }
      const insertActivity = db.prepare(`INSERT OR IGNORE INTO activities
        (id, external_key, item_canonical_id, source, event_type, activity_at, title, subtitle, rating_key, metadata_json, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
      for (const entry of activity) {
        if (!items.some(item => item.canonicalId === entry.itemCanonicalId)) continue;
        insertActivity.run(entry.id, String(entry.externalKey || entry.id), entry.itemCanonicalId, entry.source || "manual",
          entry.eventType || "activity", entry.activityAt || entry.createdAt || now(), entry.title || "", entry.subtitle || "",
          entry.ratingKey == null ? null : String(entry.ratingKey), JSON.stringify(scrubEmbeddedDataUris(entry.metadata || {})), entry.createdAt || now());
      }

      db.exec("DELETE FROM backlog_entries");
      const insertEntry = db.prepare(`INSERT OR IGNORE INTO backlog_entries
        (id, item_canonical_id, activity_id, reason, created_at, dismissed_at) VALUES (?,?,?,?,?,?)`);
      for (const entry of backlogEntries) {
        if (!items.some(item => item.canonicalId === entry.itemCanonicalId)) continue;
        insertEntry.run(entry.id, entry.itemCanonicalId, String(entry.activityId || entry.id), entry.reason || "recent", entry.createdAt || now(), entry.dismissedAt || null);
      }
    });
  }

  close() {
    try { this.sqlite.db?.exec("PRAGMA wal_checkpoint(TRUNCATE)"); } catch {}
    this.sqlite.close();
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
    return { schema: "sqlite-core-v1", database: path.basename(this.sqlite.filePath), integrity: this.sqlite.integrityCheck(), counts, lastSyncAt: this.lastSyncAt, lastSyncReason: this.lastSyncReason };
  }
}
