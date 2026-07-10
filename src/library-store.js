import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

function now() { return new Date().toISOString(); }
function queueWrite(instance, filePath, data) {
  const content = JSON.stringify(data, null, 2);
  instance.writeQueue = instance.writeQueue.then(() => fs.writeFile(filePath, content, "utf8"));
  return instance.writeQueue;
}
function mediaTypeFromMime(mime = "") { return String(mime).startsWith("video/") ? "video" : "image"; }

export class WallpaperStore {
  constructor(dataDir) {
    this.filePath = path.join(dataDir, "wallpapers.json");
    this.wallpapers = [];
    this.writeQueue = Promise.resolve();
  }
  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, "utf8"));
      this.wallpapers = Array.isArray(parsed) ? parsed.map(w => ({ type: w.type || (String(w.mime || "").startsWith("video/") ? "video" : "image"), audioEnabled: false, volume: 0.35, finishBeforeNext: false, ...w })) : [];
    } catch (error) { if (error.code !== "ENOENT") console.error("No se pudieron cargar wallpapers:", error); }
    await this.persist();
  }
  list({ includeArchived = true } = {}) {
    return this.wallpapers.filter(w => w.status !== "deleted" && (includeArchived || w.status === "active"));
  }
  async add({ title = "Wallpaper", asset, source = "manual", status = "active", meta = {}, audioEnabled = false, volume = 0.35, finishBeforeNext = false }) {
    const item = {
      id: crypto.randomUUID(),
      title,
      source,
      status,
      type: mediaTypeFromMime(asset?.mime),
      mime: asset?.mime || null,
      assetPath: asset.path,
      audioEnabled: Boolean(audioEnabled),
      finishBeforeNext: Boolean(finishBeforeNext),
      volume: Math.max(0, Math.min(1, Number(volume) || 0.35)),
      createdAt: now(),
      updatedAt: now(),
      meta
    };
    this.wallpapers.unshift(item);
    await this.persist();
    return item;
  }
  async update(id, patch = {}) {
    const item = this.wallpapers.find(w => w.id === id);
    if (!item) throw new Error("Wallpaper no encontrado.");
    if (patch.volume !== undefined) patch.volume = Math.max(0, Math.min(1, Number(patch.volume) || 0));
    Object.assign(item, patch, { updatedAt: now() });
    await this.persist();
    return item;
  }
  async remove(id) {
    const index = this.wallpapers.findIndex(w => w.id === id);
    if (index === -1) throw new Error("Wallpaper no encontrado.");
    const [removed] = this.wallpapers.splice(index, 1);
    await this.persist();
    return removed;
  }
  async persist() { return queueWrite(this, this.filePath, this.wallpapers); }
}

export class CollectionStore {
  constructor(dataDir) {
    this.filePath = path.join(dataDir, "collections.json");
    this.collections = [];
    this.writeQueue = Promise.resolve();
  }
  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, "utf8"));
      this.collections = Array.isArray(parsed) ? parsed.map(c => ({ dashboardEnabled: false, layout: c.layout || "masonry", ...c, items: (c.items || []).map(item => ({ coverPath: item.coverPath || item.assetPath || null, backdropPath: item.backdropPath || item.meta?.backdropPath || null, videoPath: item.videoPath || item.meta?.videoPath || null, videoFinishBeforeNext: Boolean(item.videoFinishBeforeNext ?? item.meta?.videoFinishBeforeNext ?? false), displaySkin: item.displaySkin || item.meta?.displaySkin || 'none', ...item })) })) : [];
    } catch (error) { if (error.code !== "ENOENT") console.error("No se pudieron cargar colecciones:", error); }
    if (!this.collections.length) {
      this.collections = [{ id: crypto.randomUUID(), name: "Favoritos", mode: "presentation", layout: "masonry", dashboardEnabled: false, items: [], createdAt: now(), updatedAt: now() }];
    }
    await this.persist();
  }
  list() { return this.collections; }
  get(id) { return this.collections.find(c => c.id === id); }
  async create({ name = "Nueva colección" } = {}) {
    const collection = { id: crypto.randomUUID(), name: String(name || "Nueva colección"), mode: "presentation", layout: "masonry", dashboardEnabled: false, items: [], createdAt: now(), updatedAt: now() };
    this.collections.unshift(collection);
    await this.persist();
    return collection;
  }
  async update(id, patch = {}) {
    const collection = this.get(id);
    if (!collection) throw new Error("Colección no encontrada.");
    if (patch.name !== undefined) collection.name = String(patch.name || collection.name);
    if (patch.mode !== undefined) collection.mode = patch.mode === "manage" ? "manage" : "presentation";
    if (patch.layout !== undefined) collection.layout = patch.layout === "square" ? "square" : "masonry";
    if (patch.dashboardEnabled !== undefined) collection.dashboardEnabled = Boolean(patch.dashboardEnabled);
    collection.updatedAt = now();
    await this.persist();
    return collection;
  }
  async remove(id) {
    const index = this.collections.findIndex(c => c.id === id);
    if (index === -1) throw new Error("Colección no encontrada.");
    const [removed] = this.collections.splice(index, 1);
    if (!this.collections.length) await this.create({ name: "Favoritos" });
    await this.persist();
    return removed;
  }
  async addItem(collectionId, { title = "Imagen", asset, backdropAsset = null, videoAsset = null, source = "manual", videoFinishBeforeNext = false, meta = {} }) {
    const collection = this.get(collectionId);
    if (!collection) throw new Error("Colección no encontrada.");
    const item = {
      id: crypto.randomUUID(),
      title,
      source,
      assetPath: asset.path,
      coverPath: asset.path,
      backdropPath: backdropAsset?.path || meta.backdropPath || null,
      videoPath: videoAsset?.path || meta.videoPath || null,
      videoMime: videoAsset?.mime || meta.videoMime || null,
      videoFinishBeforeNext: Boolean(videoFinishBeforeNext ?? meta.videoFinishBeforeNext ?? false),
      displaySkin: meta.displaySkin || 'none',
      mime: asset.mime || null,
      createdAt: now(),
      meta
    };
    collection.items.unshift(item);
    collection.updatedAt = now();
    await this.persist();
    return item;
  }

  async updateItem(collectionId, itemId, patch = {}) {
    const collection = this.get(collectionId);
    if (!collection) throw new Error("Colección no encontrada.");
    const item = collection.items.find(i => i.id === itemId);
    if (!item) throw new Error("Item no encontrado.");
    if (patch.title !== undefined) item.title = String(patch.title || item.title || "Imagen");
    if (patch.source !== undefined) item.source = String(patch.source || item.source || "manual");
    if (patch.coverPath !== undefined || patch.assetPath !== undefined) {
      item.coverPath = patch.coverPath || patch.assetPath || item.coverPath || null;
      item.assetPath = item.coverPath || item.assetPath || null;
    }
    if (patch.backdropPath !== undefined) item.backdropPath = patch.backdropPath || null;
    if (patch.videoPath !== undefined) item.videoPath = patch.videoPath || null;
    if (patch.videoMime !== undefined) item.videoMime = patch.videoMime || null;
    if (patch.videoFinishBeforeNext !== undefined) item.videoFinishBeforeNext = Boolean(patch.videoFinishBeforeNext);
    if (patch.displaySkin !== undefined) item.displaySkin = patch.displaySkin || "none";
    if (patch.meta && typeof patch.meta === "object" && !Array.isArray(patch.meta)) item.meta = { ...(item.meta || {}), ...patch.meta };
    collection.updatedAt = now();
    await this.persist();
    return item;
  }

  async removeItem(collectionId, itemId) {
    const collection = this.get(collectionId);
    if (!collection) throw new Error("Colección no encontrada.");
    const index = collection.items.findIndex(i => i.id === itemId);
    if (index === -1) throw new Error("Item no encontrado.");
    const [removed] = collection.items.splice(index, 1);
    collection.updatedAt = now();
    await this.persist();
    return removed;
  }
  async moveItem(collectionId, itemId, direction) {
    const collection = this.get(collectionId);
    if (!collection) throw new Error("Colección no encontrada.");
    const index = collection.items.findIndex(i => i.id === itemId);
    if (index === -1) throw new Error("Item no encontrado.");
    const target = direction === "down" || direction === "right" ? index + 1 : index - 1;
    if (target < 0 || target >= collection.items.length) return collection;
    const [item] = collection.items.splice(index, 1);
    collection.items.splice(target, 0, item);
    collection.updatedAt = now();
    await this.persist();
    return collection;
  }
  async reorderItems(collectionId, ids = []) {
    const collection = this.get(collectionId);
    if (!collection) throw new Error("Colección no encontrada.");
    const lookup = new Map(collection.items.map(item => [item.id, item]));
    const ordered = ids.map(id => lookup.get(id)).filter(Boolean);
    const rest = collection.items.filter(item => !ids.includes(item.id));
    collection.items = [...ordered, ...rest];
    collection.updatedAt = now();
    await this.persist();
    return collection;
  }
  async persist() { return queueWrite(this, this.filePath, this.collections); }
}
