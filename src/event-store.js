import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export class EventStore {
  constructor(dataDir) {
    this.filePath = path.join(dataDir, "notifications.json");
    this.notifications = [];
    this.writeQueue = Promise.resolve();
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

  countSince(isoDate) {
    if (!isoDate) return this.notifications.length;
    const cutoff = Date.parse(isoDate);
    if (!Number.isFinite(cutoff)) return this.notifications.length;
    return this.notifications.filter(item => Date.parse(item.createdAt) > cutoff).length;
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
    await this.persist();
    return notification;
  }

  async persist() {
    const content = JSON.stringify(this.notifications, null, 2);
    this.writeQueue = this.writeQueue.then(() => fs.writeFile(this.filePath, content, "utf8"));
    return this.writeQueue;
  }
}
