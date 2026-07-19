import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_STATE = {
  activeView: "backlog",
  selectedCollectionId: null,
  lastWallpaperId: null,
  lastPlex: null,
  lastGame: null,
  lastCurrent: null,
  lastNotificationsViewedAt: null,
  lastNotificationHandledId: null,
  privacyLocked: false,
  updatedAt: null
};

export class StateStore {
  constructor(dataDir) {
    this.filePath = path.join(dataDir, "state.json");
    this.state = { ...DEFAULT_STATE };
    this.writeQueue = Promise.resolve();
  }
  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, "utf8"));
      this.state = { ...DEFAULT_STATE, ...(parsed || {}) };
    } catch (error) {
      if (error.code !== "ENOENT") console.error("No se pudo cargar state.json:", error);
    }
  }
  get() { return this.state; }
  async update(patch, { immediate = false } = {}) {
    this.state = { ...this.state, ...(patch || {}), updatedAt: new Date().toISOString() };
    await this.persist({ immediate });
    return this.state;
  }
  async persist({ immediate = false } = {}) {
    this.pendingData = this.state;
    if (immediate) return this.flush();
    if (this.writeTimer) return;
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      this.flush().catch(error => console.error(`[persist] state.json error:`, error));
    }, Number(process.env.PERSIST_DEBOUNCE_MS || 350));
  }
  async flush() {
    if (this.writeTimer) { clearTimeout(this.writeTimer); this.writeTimer = null; }
    const snapshot = this.pendingData || this.state;
    this.writeQueue = this.writeQueue.then(async () => {
      const started = Date.now();
      const tmpPath = `${this.filePath}.tmp`;
      await fs.writeFile(tmpPath, JSON.stringify(snapshot), "utf8");
      await fs.rename(tmpPath, this.filePath);
      const ms = Date.now() - started;
      if (ms > 250) console.warn(`[persist] state.json ${ms}ms`);
    });
    await this.writeQueue;
  }
}
