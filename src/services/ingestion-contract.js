const EVENT_TYPES = new Set(["added", "played", "watched", "updated", "started", "completed", "activity"]);

function clean(value) { return String(value ?? "").trim(); }
function bool(value, fallback) { return value === undefined ? fallback : Boolean(value); }
function asObject(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function isoDate(value, fallback = new Date().toISOString()) {
  if (!value) return fallback;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("occurredAt debe ser una fecha válida.");
  return date.toISOString();
}

export function normalizeIngestionPayload(payload = {}) {
  const source = clean(payload.source).toLowerCase();
  const title = clean(payload.title);
  const externalId = clean(payload.externalId || payload.sourceId || payload.id);
  const canonicalId = clean(payload.canonicalId);
  if (!source) throw new Error("source es obligatorio.");
  if (!title) throw new Error("title es obligatorio.");
  if (!canonicalId && !externalId) throw new Error("canonicalId o externalId es obligatorio.");

  const eventTypeRaw = clean(payload.eventType || payload.event || "updated").toLowerCase();
  const eventType = EVENT_TYPES.has(eventTypeRaw) ? eventTypeRaw : "activity";
  const behavior = asObject(payload.behavior);
  const assets = asObject(payload.assets);
  const metadata = asObject(payload.metadata || payload.meta);

  return {
    apiVersion: "1",
    source,
    externalId,
    canonicalId: canonicalId || `${source}:${externalId}`,
    entityType: clean(payload.entityType || payload.collectionType || payload.type || "item").toLowerCase(),
    title,
    detail: clean(payload.detail ?? payload.subtitle),
    eventType,
    occurredAt: isoDate(payload.occurredAt || payload.activityAt || payload.lastActivityAt),
    assets: {
      poster: clean(assets.poster || payload.poster || payload.posterUrl || payload.cover) || null,
      backdrop: clean(assets.backdrop || payload.backdrop || payload.backdropUrl || payload.background) || null
    },
    metadata,
    behavior: {
      createIfMissing: bool(behavior.createIfMissing, true),
      updateMetadata: bool(behavior.updateMetadata, true),
      updateDetail: bool(behavior.updateDetail, true),
      updateActivity: bool(behavior.updateActivity, true),
      clearCharred: bool(behavior.clearCharred, false),
      showToast: bool(behavior.showToast, false)
    }
  };
}

export function ingestionExample() {
  return {
    source: "example",
    externalId: "item-123",
    entityType: "series",
    title: "Ejemplo",
    detail: "S01E03 · reproducido",
    eventType: "played",
    occurredAt: new Date().toISOString(),
    assets: { poster: "https://…/poster.jpg", backdrop: "https://…/backdrop.jpg" },
    metadata: { provider: "example" },
    behavior: { createIfMissing: true, updateMetadata: true, updateDetail: true, updateActivity: true, clearCharred: true, showToast: true }
  };
}
