import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export class EventStore {
  constructor(dataDir, { maxStored = 200 } = {}) {
    this.filePath = path.join(dataDir, "notifications.json");
    this.notifications = [];
    this.maxStored = Number(maxStored) || 0;
    this.writeQueue = Promise.resolve();
  }

  setMaxStored(maxStored) {
    this.maxStored = Number(maxStored) || 0;
    if (this.maxStored > 0 && this.notifications.length > this.maxStored) {
      this.notifications = this.notifications.slice(0, this.maxStored);
      this.persist().catch(error => console.error("No se pudo aplicar maxStored:", error));
    }
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      this.notifications = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      if (error.code !== "ENOENT") console.error("No se pudieron cargar notificaciones:", error);
      this.notifications = [];
    }
  }

  list({ page = 1, limit = 5 } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 5));
    const total = this.notifications.length;
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));
    const offset = (safePage - 1) * safeLimit;
    return {
      items: this.notifications.slice(offset, offset + safeLimit),
      page: Math.min(safePage, totalPages),
      limit: safeLimit,
      total,
      totalPages
    };
  }

  async add(input) {
    const notification = {
      id: crypto.randomUUID(),
      source: input.source || "system",
      type: input.type || "info",
      priority: input.priority || "normal",
      title: input.title || "Nueva notificación",
      subtitle: input.subtitle || "",
      image: input.image || null,
      backdrop: input.backdrop || null,
      createdAt: input.createdAt || new Date().toISOString(),
      meta: input.meta || {}
    };
    this.notifications.unshift(notification);
    if (this.maxStored > 0 && this.notifications.length > this.maxStored) {
      this.notifications = this.notifications.slice(0, this.maxStored);
    }
    await this.persist();
    return notification;
  }

  async persist() {
    const content = JSON.stringify(this.notifications, null, 2);
    this.writeQueue = this.writeQueue.then(() => fs.writeFile(this.filePath, content, "utf8"));
    return this.writeQueue;
  }
}
