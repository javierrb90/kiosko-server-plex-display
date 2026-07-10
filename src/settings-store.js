import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_SETTINGS = {
  server: { port: 3000 },
  plex: { enabled: true, url: "", token: "" },
  display: {
    dimEnabled: true,
    dimTimeoutSeconds: 30,
    dimOpacity: 0.6,
    dimByView: {
      dashboard: { enabled: true, afterSeconds: 45, opacity: 0.45 },
      "current-content": { enabled: true, afterSeconds: 30, opacity: 0.75 },
      collections: { enabled: true, afterSeconds: 60, opacity: 0.25 }
    },
    dockAutoHide: true,
    dockAutoHideSeconds: 4,
    dockPosition: "bottom"
  },
  dashboard: {
    wallpaperIntervalSeconds: 35,
    wallpaperFadeSeconds: 1,
    wallpaperMotion: true,
    showProgressBar: true,
    progressBarOpacity: 0.75,
    videoAudioGlobalEnabled: true,
    videoAudioDefaultMuted: true,
    sources: {
      wallpapers: true,
      collections: []
    }
  },
  views: {
    dashboard: { enabled: true },
    notifications: { enabled: true, itemsPerPage: 50 },
    current: { enabled: true },
    collections: { enabled: true, layout: "masonry", size: "xl" }
  },
  integrations: {
    tautulli: { enabled: true, notifyLibraryAdded: true, showPlaybackOn: ["play", "start"] },
    arr: { enabled: true, storeTestNotifications: true, enabledEvents: ["grab", "movie_add", "series_add"] },
    playnite: { enabled: true, maxPayloadMb: 80 }
  },
  notifications: { maxStored: 50, toastEnabled: true, toastDurationSeconds: 6, toastSize: "large", soundEnabled: false, soundVolume: 0.35 },
  wallpapers: { allowGifs: true, allowVideos: true, allowVideoAudio: true },
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

function sanitize(settings) {
  const s = deepMerge(DEFAULT_SETTINGS, settings || {});
  s.server.port = clampNumber(s.server.port, 1, 65535, 3000);

  s.display.dimTimeoutSeconds = clampNumber(s.display.dimTimeoutSeconds, 2, 3600, 30);
  s.display.dimOpacity = normalizeOpacity(s.display.dimOpacity, 0.6);
  s.display.dockAutoHideSeconds = clampNumber(s.display.dockAutoHideSeconds, 1, 60, 4);
  if (!["top", "bottom", "left", "right"].includes(s.display.dockPosition)) s.display.dockPosition = "bottom";

  const defaultsByView = DEFAULT_SETTINGS.display.dimByView;
  for (const viewId of Object.keys(defaultsByView)) {
    const current = s.display.dimByView?.[viewId] || {};
    s.display.dimByView[viewId] = {
      enabled: current.enabled !== false,
      afterSeconds: clampNumber(current.afterSeconds, 2, 3600, defaultsByView[viewId].afterSeconds),
      opacity: normalizeOpacity(current.opacity, defaultsByView[viewId].opacity)
    };
  }

  s.dashboard.wallpaperIntervalSeconds = clampNumber(s.dashboard.wallpaperIntervalSeconds ?? s.display.wallpaperIntervalSeconds, 5, 3600, 35);
  s.dashboard.wallpaperFadeSeconds = clampNumber(s.dashboard.wallpaperFadeSeconds, 0, 10, 1);
  s.dashboard.progressBarOpacity = normalizeOpacity(s.dashboard.progressBarOpacity, 0.75);
  if (!isObject(s.dashboard.sources)) s.dashboard.sources = { wallpapers: true, collections: [] };
  s.dashboard.sources.wallpapers = s.dashboard.sources.wallpapers !== false;
  if (!Array.isArray(s.dashboard.sources.collections)) s.dashboard.sources.collections = [];

  s.views.notifications.itemsPerPage = clampNumber(s.views.notifications.itemsPerPage, 1, 50, 50);
  s.notifications.maxStored = clampNumber(s.notifications.maxStored, 1, 50, 50);
  s.notifications.toastDurationSeconds = clampNumber(s.notifications.toastDurationSeconds, 1, 60, 6);
  if (!["small", "medium", "large"].includes(s.notifications.toastSize)) s.notifications.toastSize = "large";
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
