import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { canonicalKeyForItem } from "./backlog-store.js";

function now() { return new Date().toISOString(); }
function clean(value) { return String(value ?? "").trim(); }
function normalizeSource(value) { const source = clean(value).toLowerCase(); return source === "plex" || source === "playnite" ? source : "manual"; }
function canonicalizePlexSeriesInput(input = {}) {
  if (normalizeSource(input.source) !== "plex") return input;
  const plexType = input.meta?.plexType || input.type;
  const isSeriesItem = input.collectionType === "series" || ["episode", "season", "show"].includes(plexType);
  if (!isSeriesItem || input.collectionType === "movies") return input;
  const canonicalRatingKey = input.meta?.canonicalRatingKey || input.meta?.grandparentRatingKey || input.grandparentRatingKey || input.meta?.parentRatingKey || input.parentRatingKey || input.ratingKey;
  return {
    ...input,
    type: "show",
    collectionType: "series",
    canonicalId: input.canonicalId || (canonicalRatingKey ? `plex:series:${canonicalRatingKey}` : input.canonicalId),
    ratingKey: canonicalRatingKey || input.ratingKey,
    title: input.meta?.grandparentTitle || input.meta?.showTitle || input.meta?.seriesTitle || input.title,
    subtitle: "Serie",
    meta: {
      ...(input.meta || {}),
      plexType,
      originalType: plexType,
      originalRatingKey: input.ratingKey,
      originalTitle: input.title,
      originalSubtitle: input.subtitle,
      canonicalRatingKey: canonicalRatingKey || input.meta?.canonicalRatingKey || null
    }
  };
}
function queueWrite(instance, filePath, data) {
  const content = JSON.stringify(data);
  instance.writeQueue = instance.writeQueue.then(async () => {
    const started = Date.now();
    await fs.writeFile(filePath, content, "utf8");
    const ms = Date.now() - started;
    if (ms > 250) console.warn(`[persist] ${path.basename(filePath)} ${ms}ms`);
  });
  return instance.writeQueue;
}

export class OnDeckStore {
  constructor(dataDir) {
    this.filePath = path.join(dataDir, "on-deck.json");
    this.items = [];
    this.writeQueue = Promise.resolve();
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, "utf8"));
      this.items = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      if (error.code !== "ENOENT") console.error("No se pudo cargar On Deck:", error);
    }
    await this.persist();
  }

  list() { return this.items; }
  findByCanonicalId(canonicalId) { return this.items.find(item => item.canonicalId === canonicalId); }
  map() { return Object.fromEntries(this.items.map(item => [item.canonicalId, { id: item.id, addedToDeckAt: item.addedToDeckAt, lastActivityAt: item.lastActivityAt, updatedAt: item.updatedAt }])); }

  async upsert(input = {}) {
    input = canonicalizePlexSeriesInput(input);
    const date = now();
    const source = normalizeSource(input.source);
    const canonicalId = canonicalKeyForItem({ ...input, source });
    const existingIndex = this.items.findIndex(item => item.canonicalId === canonicalId);
    const previous = existingIndex >= 0 ? this.items.splice(existingIndex, 1)[0] : null;
    const item = {
      ...(previous || {}),
      id: previous?.id || crypto.randomUUID(),
      source,
      type: input.type || previous?.type || "item",
      collectionType: input.collectionType || previous?.collectionType || (source === "playnite" ? "games" : "series"),
      canonicalId,
      title: clean(input.title || previous?.title || "Sin título") || "Sin título",
      subtitle: clean(input.subtitle || previous?.subtitle || ""),
      poster: input.poster ?? input.posterUrl ?? input.cover ?? previous?.poster ?? null,
      backdrop: input.backdrop ?? input.backdropUrl ?? input.background ?? previous?.backdrop ?? null,
      year: input.year ?? previous?.year ?? "",
      ratingKey: input.ratingKey ?? previous?.ratingKey ?? null,
      gameId: input.gameId ?? previous?.gameId ?? null,
      meta: { ...(previous?.meta || {}), ...(input.meta || {}) },
      addedToDeckAt: previous?.addedToDeckAt || date,
      updatedAt: date,
      lastActivityAt: input.lastActivityAt || previous?.lastActivityAt || date
    };
    this.items.unshift(item);
    await this.persist();
    return item;
  }

  async remove(id) {
    const index = this.items.findIndex(item => item.id === id || item.canonicalId === id);
    if (index < 0) throw new Error("Item de On Deck no encontrado.");
    const [removed] = this.items.splice(index, 1);
    await this.persist();
    return removed;
  }

  async removeByCanonicalId(canonicalId) {
    const index = this.items.findIndex(item => item.canonicalId === canonicalId);
    if (index < 0) return null;
    const [removed] = this.items.splice(index, 1);
    await this.persist();
    return removed;
  }

  async persist() { return queueWrite(this, this.filePath, this.items); }
}
