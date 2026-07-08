import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

function now() { return new Date().toISOString(); }
function queueWrite(instance, filePath, data) {
  const content = JSON.stringify(data, null, 2);
  instance.writeQueue = instance.writeQueue.then(() => fs.writeFile(filePath, content, "utf8"));
  return instance.writeQueue;
}

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
      this.wallpapers = Array.isArray(parsed) ? parsed : [];
    } catch (error) { if (error.code !== "ENOENT") console.error("No se pudieron cargar wallpapers:", error); }
    await this.persist();
  }
  list({ includeArchived = true } = {}) {
    return this.wallpapers.filter(w => w.status !== "deleted" && (includeArchived || w.status === "active"));
  }
  async add({ title = "Wallpaper", asset, source = "manual", status = "active", meta = {} }) {
    const item = { id: crypto.randomUUID(), title, source, status, assetPath: asset.path, createdAt: now(), updatedAt: now(), meta };
    this.wallpapers.unshift(item);
    await this.persist();
    return item;
  }
  async update(id, patch = {}) {
    const item = this.wallpapers.find(w => w.id === id);
    if (!item) throw new Error("Wallpaper no encontrado.");
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
      this.collections = Array.isArray(parsed) ? parsed : [];
    } catch (error) { if (error.code !== "ENOENT") console.error("No se pudieron cargar colecciones:", error); }
    if (!this.collections.length) {
      this.collections = [{ id: crypto.randomUUID(), name: "Favoritos", mode: "presentation", items: [], createdAt: now(), updatedAt: now() }];
    }
    await this.persist();
  }
  list() { return this.collections; }
  get(id) { return this.collections.find(c => c.id === id); }
  async create({ name = "Nueva colección" } = {}) {
    const collection = { id: crypto.randomUUID(), name: String(name || "Nueva colección"), mode: "presentation", items: [], createdAt: now(), updatedAt: now() };
    this.collections.unshift(collection);
    await this.persist();
    return collection;
  }
  async update(id, patch = {}) {
    const collection = this.get(id);
    if (!collection) throw new Error("Colección no encontrada.");
    if (patch.name !== undefined) collection.name = String(patch.name || collection.name);
    if (patch.mode !== undefined) collection.mode = patch.mode === "manage" ? "manage" : "presentation";
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
  async addItem(collectionId, { title = "Imagen", asset, source = "manual", meta = {} }) {
    const collection = this.get(collectionId);
    if (!collection) throw new Error("Colección no encontrada.");
    const item = { id: crypto.randomUUID(), title, source, assetPath: asset.path, createdAt: now(), meta };
    collection.items.unshift(item);
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
