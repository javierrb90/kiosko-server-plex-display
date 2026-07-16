import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const MAX_NOTIFICATIONS = 50;
const IDEMPOTENCY_TTL_DAYS = 7;
const IDEMPOTENCY_TTL_MS = IDEMPOTENCY_TTL_DAYS * 24 * 60 * 60 * 1000;

export class EventStore {
  constructor(dataDir) {
    this.filePath = path.join(dataDir, "notifications.json");
    this.idempotencyPath = path.join(dataDir, "notification-idempotency.json");
    this.notifications = [];
    this.idempotency = {};
    this.operationQueue = Promise.resolve();
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      this.notifications = Array.isArray(parsed) ? parsed.slice(0, MAX_NOTIFICATIONS) : [];
    } catch (error) {
      if (error.code !== "ENOENT") console.error("No se pudieron cargar notificaciones:", error);
      this.notifications = [];
    }

    try {
      const raw = await fs.readFile(this.idempotencyPath, "utf8");
      const parsed = JSON.parse(raw);
      this.idempotency = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      if (error.code !== "ENOENT") console.error("No se pudo cargar notification-idempotency.json:", error);
      this.idempotency = {};
    }

    this.pruneIdempotencyKeys();
    await this.persistIdempotency();
  }

  enqueue(operation) {
    const run = this.operationQueue.then(operation, operation);
    this.operationQueue = run.catch(() => {});
    return run;
  }

  list({ page = 1, limit = 5 } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(MAX_NOTIFICATIONS, Math.max(1, Number(limit) || 5));
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
    return this.enqueue(async () => {
      const notification = this.buildNotification(input);
      this.notifications.unshift(notification);
      this.notifications = this.notifications.slice(0, MAX_NOTIFICATIONS);
      await this.persistNotifications();
      return notification;
    });
  }

  async clear() {
    return this.enqueue(async () => {
      this.notifications = [];
      await this.persistNotifications();
      return { ok: true };
    });
  }

  async addExternal(input, externalId = null) {
    return this.enqueue(async () => {
      this.pruneIdempotencyKeys();

      if (externalId) {
        const existing = this.findByExternalId(externalId);
        if (existing || this.idempotency[externalId]) {
          await this.persistIdempotency();
          return {
            duplicate: true,
            notification: existing || null
          };
        }
      }

      const notification = this.buildNotification(input, externalId);
      this.notifications.unshift(notification);
      this.notifications = this.notifications.slice(0, MAX_NOTIFICATIONS);

      await this.persistNotifications();

      if (externalId) {
        this.idempotency[externalId] = notification.createdAt;
        await this.persistIdempotency();
      }

      return {
        duplicate: false,
        notification
      };
    });
  }

  buildNotification(input = {}, externalId = null) {
    const meta = input.meta && typeof input.meta === "object" && !Array.isArray(input.meta)
      ? { ...input.meta }
      : {};

    if (externalId && !meta.externalId) meta.externalId = externalId;

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
      meta
    };

    if (externalId) notification.externalId = externalId;
    if (input.url) notification.url = input.url;

    return notification;
  }

  findByExternalId(externalId) {
    return this.notifications.find(notification => (
      notification.externalId === externalId || notification.meta?.externalId === externalId
    )) || null;
  }

  pruneIdempotencyKeys(now = Date.now()) {
    for (const [externalId, date] of Object.entries(this.idempotency)) {
      const timestamp = Date.parse(date);
      if (!Number.isFinite(timestamp) || now - timestamp > IDEMPOTENCY_TTL_MS) {
        delete this.idempotency[externalId];
      }
    }
  }

  async persistNotifications() {
    await this.atomicWriteJson(this.filePath, this.notifications);
  }

  async persistIdempotency() {
    await this.atomicWriteJson(this.idempotencyPath, this.idempotency);
  }

  async atomicWriteJson(filePath, data) {
    const content = JSON.stringify(data);
    const tmpPath = `${filePath}.tmp`;
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const started = Date.now();
    await fs.writeFile(tmpPath, content, "utf8");
    await fs.rename(tmpPath, filePath);
    const ms = Date.now() - started;
    if (ms > 250) console.warn(`[persist] ${path.basename(filePath)} ${ms}ms`);
  }
}
