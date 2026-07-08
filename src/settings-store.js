import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_SETTINGS = {
  server: { port: 3000 },
  plex: { enabled: true, url: "", token: "" },
  display: {
    dimEnabled: true,
    dimTimeoutSeconds: 10,
    dimOpacity: 0.5,
    wallpaperIntervalSeconds: 35,
    wallpaperAnimation: false,
    dockAutoHide: true,
    dockAutoHideSeconds: 4
  },
  views: {
    dashboard: { enabled: true },
    notifications: { enabled: true, itemsPerPage: 5 },
    plex: { enabled: true },
    game: { enabled: true },
    collections: { enabled: true },
    settings: { enabled: true }
  },
  integrations: {
    tautulli: { enabled: true, notifyLibraryAdded: true, showPlaybackOn: ["play", "start"] },
    arr: { enabled: true, storeTestNotifications: true, enabledEvents: ["grab", "movie_add", "series_add"] },
    playnite: { enabled: true, maxPayloadMb: 35 }
  },
  notifications: { maxStored: 250, toastEnabled: true, toastDurationSeconds: 6 },
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

function sanitize(settings) {
  const s = deepMerge(DEFAULT_SETTINGS, settings || {});
  s.server.port = clampNumber(s.server.port, 1, 65535, 3000);
  s.display.dimTimeoutSeconds = clampNumber(s.display.dimTimeoutSeconds, 2, 3600, 10);
  s.display.dimOpacity = clampNumber(s.display.dimOpacity, 0, 0.95, 0.5);
  s.display.wallpaperIntervalSeconds = clampNumber(s.display.wallpaperIntervalSeconds, 5, 3600, 35);
  s.display.dockAutoHideSeconds = clampNumber(s.display.dockAutoHideSeconds, 1, 60, 4);
  s.views.notifications.itemsPerPage = clampNumber(s.views.notifications.itemsPerPage, 1, 20, 5);
  s.notifications.maxStored = clampNumber(s.notifications.maxStored, 10, 5000, 250);
  s.notifications.toastDurationSeconds = clampNumber(s.notifications.toastDurationSeconds, 1, 60, 6);
  s.integrations.playnite.maxPayloadMb = clampNumber(s.integrations.playnite.maxPayloadMb, 1, 100, 35);
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
