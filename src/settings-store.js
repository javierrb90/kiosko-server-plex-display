import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_SETTINGS = {
  server: { port: 3000 },
  plex: { enabled: true, url: "", token: "" },
  display: {
    defaultView: "backlog",
    dockPosition: "top"
  },
  design: {
    accentColor: "#8fafef",
    fontScale: "medium",
    density: "comfortable"
  },
  views: {
    notifications: { enabled: true, itemsPerPage: 50 },
    backlog: { enabled: true, cardSize: "medium", itemsPerPage: 12 },
    current: { enabled: true },
    collections: { enabled: true, cardSize: "medium", itemsPerPage: 12 }
  },
  backlog: {
    sources: {
      plexRecentlyAdded: true,
      plexPlayback: false,
      playniteStarted: true
    }
  },
  integrations: {
    tautulli: { enabled: true, notifyLibraryAdded: true, showPlaybackOn: ["play", "start"] },
    arr: { enabled: true, storeTestNotifications: true, enabledEvents: ["grab", "movie_add", "series_add"] },
    playnite: { enabled: true, maxPayloadMb: 80 }
  },
  notifications: {
    maxStored: 50,
    toastEnabled: true,
    toastDurationSeconds: 6,
    toastSize: "medium",
    soundEnabled: false,
    soundVolume: 0.35
  },
  customCss: { enabled: true }
};

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

export function deepMerge(base, override) {
  if (!isObject(base)) return override ?? base;
  const output = { ...base };
  if (!isObject(override)) return output;
  for (const [key, value] of Object.entries(override)) {
    output[key] = isObject(value) && isObject(base[key]) ? deepMerge(base[key], value) : value;
  }
  return output;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeOpacity(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (n > 1) return clampNumber(n, 0, 100, fallback * 100) / 100;
  return clampNumber(n, 0, 1, fallback);
}

function cardSize(value) {
  return ["small", "medium", "large"].includes(value) ? value : "medium";
}

function fontScale(value) {
  return ["small", "medium", "large"].includes(value) ? value : "medium";
}

function density(value) {
  return ["compact", "comfortable", "large"].includes(value) ? value : "comfortable";
}

function color(value, fallback = "#8fafef") {
  const text = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

function sanitize(settings) {
  const s = deepMerge(DEFAULT_SETTINGS, settings || {});
  s.server.port = clampNumber(s.server.port, 1, 65535, 3000);

  // Migraciones desde v4/v5.2: todo lo que apunte al Dashboard vuelve a Backlog.
  if (s.display?.defaultView === "dashboard") s.display.defaultView = "backlog";
  if (!["backlog", "current-content", "collections"].includes(s.display.defaultView)) s.display.defaultView = "backlog";
  s.display.dockPosition = "top";

  // El oscurecimiento automático, wallpapers del Dashboard y colecciones manuales quedan fuera del modelo v5.3.
  delete s.display.dimEnabled;
  delete s.display.dimTimeoutSeconds;
  delete s.display.dimOpacity;
  delete s.display.dimByView;
  delete s.display.dockAutoHide;
  delete s.display.dockAutoHideSeconds;
  delete s.dashboard;
  delete s.wallpapers;

  if (!isObject(s.views)) s.views = DEFAULT_SETTINGS.views;
  if (!isObject(s.views.notifications)) s.views.notifications = { enabled: true, itemsPerPage: 50 };
  s.views.notifications.itemsPerPage = clampNumber(s.views.notifications.itemsPerPage, 1, 50, 50);
  s.views.backlog = { enabled: true, ...(isObject(s.views.backlog) ? s.views.backlog : {}), cardSize: cardSize(s.views.backlog?.cardSize), itemsPerPage: clampNumber(s.views.backlog?.itemsPerPage, 1, 60, 12) };
  s.views.current = { enabled: true, ...(isObject(s.views.current) ? s.views.current : {}) };
  s.views.collections = { enabled: true, ...(isObject(s.views.collections) ? s.views.collections : {}), cardSize: cardSize(s.views.collections?.cardSize), itemsPerPage: clampNumber(s.views.collections?.itemsPerPage, 1, 120, 12) };
  delete s.views.dashboard;

  if (!isObject(s.design)) s.design = {};
  s.design.accentColor = color(s.design.accentColor);
  s.design.fontScale = fontScale(s.design.fontScale);
  s.design.density = density(s.design.density);

  if (!isObject(s.backlog)) s.backlog = { sources: {} };
  if (!isObject(s.backlog.sources)) s.backlog.sources = {};
  s.backlog.sources.plexRecentlyAdded = s.backlog.sources.plexRecentlyAdded !== false;
  s.backlog.sources.plexPlayback = s.backlog.sources.plexPlayback === true;
  s.backlog.sources.playniteStarted = s.backlog.sources.playniteStarted !== false;

  s.notifications.maxStored = clampNumber(s.notifications.maxStored, 1, 50, 50);
  s.notifications.toastDurationSeconds = clampNumber(s.notifications.toastDurationSeconds, 1, 60, 6);
  if (!["small", "medium", "large"].includes(s.notifications.toastSize)) s.notifications.toastSize = "medium";
  s.notifications.soundVolume = normalizeOpacity(s.notifications.soundVolume, 0.35);

  s.integrations.playnite.maxPayloadMb = clampNumber(s.integrations.playnite.maxPayloadMb, 1, 250, 80);
  if (!Array.isArray(s.integrations.tautulli.showPlaybackOn)) s.integrations.tautulli.showPlaybackOn = ["play", "start"];
  if (!Array.isArray(s.integrations.arr.enabledEvents)) s.integrations.arr.enabledEvents = ["grab", "movie_add", "series_add"];
  return s;
}

export class SettingsStore {
  constructor(dataDir, env = process.env) {
    this.filePath = path.join(dataDir, "settings.json");
    this.settings = null;
    this.writeQueue = Promise.resolve();
    this.env = env;
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    let existing = null;
    try {
      existing = JSON.parse(await fs.readFile(this.filePath, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") console.error("No se pudieron cargar settings:", error);
    }

    const fromEnv = {};
    if (this.env.PLEX_URL || this.env.PLEX_TOKEN) {
      fromEnv.plex = { url: this.env.PLEX_URL || "", token: this.env.PLEX_TOKEN || "" };
    }
    if (this.env.PORT) fromEnv.server = { port: Number(this.env.PORT) };

    this.settings = sanitize(deepMerge(fromEnv, existing || {}));
    await this.persist();
  }

  get() { return this.settings; }

  async update(patch) {
    this.settings = sanitize(deepMerge(this.settings, patch || {}));
    await this.persist();
    return this.settings;
  }

  async replace(next) {
    this.settings = sanitize(next || {});
    await this.persist();
    return this.settings;
  }

  async reset() {
    this.settings = sanitize(DEFAULT_SETTINGS);
    await this.persist();
    return this.settings;
  }

  async persist() {
    const content = JSON.stringify(this.settings, null, 2);
    this.writeQueue = this.writeQueue.then(() => fs.writeFile(this.filePath, content, "utf8"));
    return this.writeQueue;
  }
}
