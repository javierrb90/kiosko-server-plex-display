import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

function now() { return new Date().toISOString(); }
function clean(value) { return String(value ?? "").trim(); }
function slug(value) { return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item"; }
function queueWrite(instance, filePath, data) { const content = JSON.stringify(data, null, 2); instance.writeQueue = instance.writeQueue.then(() => fs.writeFile(filePath, content, "utf8")); return instance.writeQueue; }
function normalizeSource(value) { const source = clean(value).toLowerCase(); return source === "plex" || source === "playnite" ? source : "manual"; }
function normalizeRating(value) { const rating = Number(value); if (!Number.isFinite(rating)) return 0; return Math.max(0, Math.min(5, Math.round(rating))); }

export function canonicalKeyForItem(item = {}) {
  if (item.canonicalId) return String(item.canonicalId);
  if (item.source === "playnite") return `playnite:${slug(item.gameId || item.title)}`;
  if (item.source === "plex") return `plex:${item.collectionType || item.type || "item"}:${item.ratingKey || slug(item.title)}`;
  return `${normalizeSource(item.source)}:${slug(item.title || item.id)}`;
}

export class BacklogStore {
  constructor(dataDir) { this.filePath = path.join(dataDir, "backlog.json"); this.data = { plex: [], playnite: [] }; this.writeQueue = Promise.resolve(); }
  async init() { await fs.mkdir(path.dirname(this.filePath), { recursive: true }); try { const parsed = JSON.parse(await fs.readFile(this.filePath, "utf8")); this.data = { plex: Array.isArray(parsed?.plex) ? parsed.plex : [], playnite: Array.isArray(parsed?.playnite) ? parsed.playnite : [] }; } catch (error) { if (error.code !== "ENOENT") console.error("No se pudo cargar backlog:", error); } await this.persist(); }
  list() { return this.data; }
  source(source) { return this.data[normalizeSource(source)] || []; }
  async upsert(source, input = {}, { limit = 15 } = {}) {
    const safeSource = normalizeSource(source); if (!this.data[safeSource]) throw new Error("Fuente de backlog no soportada.");
    const date = now(); const canonicalId = canonicalKeyForItem({ ...input, source: safeSource });
    const existingIndex = this.data[safeSource].findIndex(item => canonicalKeyForItem(item) === canonicalId);
    const previous = existingIndex >= 0 ? this.data[safeSource].splice(existingIndex, 1)[0] : null;
    const item = { ...(previous || {}), id: previous?.id || crypto.randomUUID(), source: safeSource, type: input.type || previous?.type || "item", collectionType: input.collectionType || previous?.collectionType || (safeSource === "playnite" ? "games" : "plex"), canonicalId, title: clean(input.title || previous?.title || "Sin título") || "Sin título", subtitle: clean(input.subtitle || previous?.subtitle || ""), poster: input.poster ?? input.posterUrl ?? input.cover ?? previous?.poster ?? null, backdrop: input.backdrop ?? input.backdropUrl ?? input.background ?? previous?.backdrop ?? null, year: input.year ?? previous?.year ?? "", ratingKey: input.ratingKey ?? previous?.ratingKey ?? null, gameId: input.gameId ?? previous?.gameId ?? null, meta: { ...(previous?.meta || {}), ...(input.meta || {}) }, createdAt: previous?.createdAt || date, updatedAt: date, lastActivityAt: input.lastActivityAt || date };
    this.data[safeSource].unshift(item); this.data[safeSource] = this.data[safeSource].slice(0, Math.max(1, Number(limit || 15))); await this.persist(); return item;
  }
  async remove(source, id) { const safeSource = normalizeSource(source); const list = this.data[safeSource]; if (!list) throw new Error("Fuente de backlog no soportada."); const index = list.findIndex(item => item.id === id || canonicalKeyForItem(item) === id); if (index < 0) throw new Error("Item de backlog no encontrado."); const [removed] = list.splice(index, 1); await this.persist(); return removed; }
  async persist() { return queueWrite(this, this.filePath, this.data); }
}

export class CompletionStore {
  constructor(dataDir) { this.filePath = path.join(dataDir, "completed-items.json"); this.items = []; this.writeQueue = Promise.resolve(); }
  async init() { await fs.mkdir(path.dirname(this.filePath), { recursive: true }); try { const parsed = JSON.parse(await fs.readFile(this.filePath, "utf8")); this.items = Array.isArray(parsed) ? parsed : []; } catch (error) { if (error.code !== "ENOENT") console.error("No se pudieron cargar completados:", error); } await this.persist(); }
  list() { return this.items; }
  findByCanonicalId(canonicalId) { return this.items.find(item => item.canonicalId === canonicalId); }
  ratingsMap() { return Object.fromEntries(this.items.map(item => [item.canonicalId, { rating: item.rating, completedAt: item.completedAt, id: item.id }])); }
  async complete(input = {}) {
    const date = now(); const canonicalId = canonicalKeyForItem(input); const rating = normalizeRating(input.rating); const existing = this.findByCanonicalId(canonicalId);
    if (existing) { Object.assign(existing, { ...input, canonicalId, rating, title: clean(input.title || existing.title || "Sin título") || "Sin título", completedAt: input.completedAt || date, updatedAt: date, meta: { ...(existing.meta || {}), ...(input.meta || {}) } }); await this.persist(); return existing; }
    const item = { id: crypto.randomUUID(), source: normalizeSource(input.source), type: input.type || "item", collectionType: input.collectionType || (input.source === "playnite" ? "games" : "plex"), canonicalId, title: clean(input.title || "Sin título") || "Sin título", subtitle: clean(input.subtitle || ""), poster: input.poster ?? input.posterUrl ?? input.cover ?? null, backdrop: input.backdrop ?? input.backdropUrl ?? input.background ?? null, year: input.year || "", rating, ratingKey: input.ratingKey || null, gameId: input.gameId || null, completedAt: input.completedAt || date, createdAt: date, updatedAt: date, meta: input.meta || {} };
    this.items.unshift(item); await this.persist(); return item;
  }
  async update(id, patch = {}) { const item = this.items.find(entry => entry.id === id); if (!item) throw new Error("Item completado no encontrado."); if (patch.rating !== undefined) item.rating = normalizeRating(patch.rating); if (patch.title !== undefined) item.title = clean(patch.title || item.title || "Sin título") || "Sin título"; if (patch.completedAt !== undefined) item.completedAt = patch.completedAt || item.completedAt; item.updatedAt = now(); await this.persist(); return item; }
  async remove(id) { const index = this.items.findIndex(entry => entry.id === id); if (index < 0) throw new Error("Item completado no encontrado."); const [removed] = this.items.splice(index, 1); await this.persist(); return removed; }
  async persist() { return queueWrite(this, this.filePath, this.items); }
}
