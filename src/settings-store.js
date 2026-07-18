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
    density: "comfortable",
    sourceColors: {
      plex: "#8fafef",
      playnite: "#8fe1b5",
      other: "#d8b4fe"
    },
    background: {
      rotationSeconds: 12,
      opacity: 0.28,
      blur: 18,
      overlayColor: "#05070c",
      overlayOpacity: 0.76,
      grayscale: 0,
      fadeSeconds: 1.2
    },
    itemBackground: {
      enabled: true,
      opacity: 0.32,
      blur: 12,
      overlayOpacity: 0.72,
      grayscale: 0
    },
    cards: {
      radius: 18
    },
    itemDetail: {
      background: { background: "backdrop", shade: "medium", blur: "soft" },
      metadataFields: {
        games: ["year", "platforms", "developers", "publishers", "genres", "playtime", "firstSeenAt", "lastActivityAt", "completedAt"],
        movies: ["year", "genres", "duration", "studio", "director", "firstSeenAt", "lastActivityAt", "completedAt"],
        series: ["year", "genres", "studio", "latestActivity", "firstSeenAt", "lastActivityAt", "completedAt"]
      }
    }
  },
  grill: { enabled: true, defaults: { backlog: 30, onDeck: 7 }, limits: {}, clearCharredOn: { manual: true, journal: true, playniteStarted: true, plexPlayback: false, plexLibraryAdded: false } },
  workspaces: {
    database: { membership: "all", grouping: "none", sort: "lastActivityAt", cardFormat: "standard", cardSize: "medium" },
    backlog: { membership: "manual", grouping: "lastActivity", sort: "lastActivityAt", cardFormat: "standard", cardSize: "medium" },
    onDeck: { membership: "manual", grouping: "none", sort: "lastActivityAt", cardFormat: "standard", cardSize: "medium", maxPerType: 3 },
    collections: { membership: "completed", grouping: "none", sort: "completedAt", cardFormat: "standard", cardSize: "medium" }
  },
  views: {
    notifications: { enabled: true, itemsPerPage: 50 },
    backlog: { enabled: true, cardSize: "medium", itemsPerPage: 12 },
    onDeck: { enabled: true, cardSize: "medium", itemsPerPage: 12 },
    current: { enabled: true },
    collections: { enabled: true, cardSize: "medium", itemsPerPage: 12 },
    database: { enabled: true, cardSize: "medium", cardFormat: "standard", itemsPerPage: 60, includeCharred: false }
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
  itemTypes: [],
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

function typeSlug(value = "") {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}
function normalizeItemTypes(value) {
  const reserved = new Set(["games", "movies", "series"]);
  const rows = Array.isArray(value) ? value : [];
  const seen = new Set();
  return rows.map(row => {
    const slug = typeSlug(row?.id || row?.slug || row?.value || row?.name);
    const singular = String(row?.singular || row?.label || row?.name || slug || "").trim();
    const plural = String(row?.plural || row?.labelPlural || row?.label || row?.name || singular || "").trim();
    return { id: slug, singular: singular || slug, plural: plural || singular || slug };
  }).filter(row => row.id && !reserved.has(row.id) && !seen.has(row.id) && seen.add(row.id)).slice(0, 24);
}

function color(value, fallback = "#8fafef") {
  const text = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

function sanitize(settings) {
  const s = deepMerge(DEFAULT_SETTINGS, settings || {});
  s.server.port = clampNumber(s.server.port, 1, 65535, 3000);

  if (s.display?.defaultView === "dashboard") s.display.defaultView = "backlog";
  if (!["database", "backlog", "on-deck", "current-content", "collections"].includes(s.display.defaultView)) s.display.defaultView = "backlog";
  s.display.dockPosition = "top";

  s.itemTypes = normalizeItemTypes(s.itemTypes || s.customItemTypes || []);

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
  s.views.backlog = { enabled: true, ...(isObject(s.views.backlog) ? s.views.backlog : {}), cardSize: cardSize(s.views.backlog?.cardSize), cardFormat: ["compact","standard","expanded"].includes(s.views.backlog?.cardFormat) ? s.views.backlog.cardFormat : "standard", itemsPerPage: clampNumber(s.views.backlog?.itemsPerPage, 1, 250, 12) };
  s.views.onDeck = { enabled: true, ...(isObject(s.views.onDeck) ? s.views.onDeck : {}), cardSize: cardSize(s.views.onDeck?.cardSize), cardFormat: ["compact","standard","expanded"].includes(s.views.onDeck?.cardFormat) ? s.views.onDeck.cardFormat : "standard", itemsPerPage: clampNumber(s.views.onDeck?.itemsPerPage, 1, 250, 12) };
  s.views.current = { enabled: true, ...(isObject(s.views.current) ? s.views.current : {}) };
  s.views.collections = { enabled: true, ...(isObject(s.views.collections) ? s.views.collections : {}), cardSize: cardSize(s.views.collections?.cardSize), cardFormat: ["compact","standard","expanded"].includes(s.views.collections?.cardFormat) ? s.views.collections.cardFormat : "standard", itemsPerPage: clampNumber(s.views.collections?.itemsPerPage, 1, 250, 12) };
  s.views.database = { enabled: true, ...(isObject(s.views.database) ? s.views.database : {}), cardSize: cardSize(s.views.database?.cardSize), cardFormat: ["compact","standard","expanded"].includes(s.views.database?.cardFormat) ? s.views.database.cardFormat : "standard", includeCharred: s.views.database?.includeCharred === true, itemsPerPage: clampNumber(s.views.database?.itemsPerPage, 10, 250, 60) };
  delete s.views.dashboard;

  if (!isObject(s.workspaces)) s.workspaces = {};
  const workspaceDefaults = DEFAULT_SETTINGS.workspaces;
  for (const key of ["database","backlog","onDeck","collections"]) {
    if (!isObject(s.workspaces[key])) s.workspaces[key] = {};
    const base = workspaceDefaults[key];
    s.workspaces[key] = { ...base, ...s.workspaces[key] };
    if (!["none","lastActivity","completedAt","type","group"].includes(s.workspaces[key].grouping)) s.workspaces[key].grouping = base.grouping;
    if (!["lastActivityAt","title","rating","completedAt"].includes(s.workspaces[key].sort)) s.workspaces[key].sort = base.sort;
    if (!["simple","standard"].includes(s.workspaces[key].cardFormat)) s.workspaces[key].cardFormat = base.cardFormat;
    s.workspaces[key].cardSize = cardSize(s.workspaces[key].cardSize);
  }

  if (!isObject(s.grill)) s.grill = {};
  s.grill.enabled = s.grill.enabled !== false;
  if (!isObject(s.grill.defaults)) s.grill.defaults = {};
  s.grill.defaults.backlog = clampNumber(s.grill.defaults.backlog, 1, 3650, 30);
  s.grill.defaults.onDeck = clampNumber(s.grill.defaults.onDeck, 1, 3650, 7);
  if (!isObject(s.grill.clearCharredOn)) s.grill.clearCharredOn = {};
  s.grill.clearCharredOn.manual = s.grill.clearCharredOn.manual !== false;
  s.grill.clearCharredOn.journal = s.grill.clearCharredOn.journal !== false;
  s.grill.clearCharredOn.playniteStarted = s.grill.clearCharredOn.playniteStarted !== false;
  s.grill.clearCharredOn.plexPlayback = s.grill.clearCharredOn.plexPlayback === true;
  s.grill.clearCharredOn.plexLibraryAdded = s.grill.clearCharredOn.plexLibraryAdded === true;
  if (!isObject(s.grill.limits)) s.grill.limits = {};
  const grillTypes = ["games","movies","series", ...s.itemTypes.map(type => type.id)];
  for (const type of grillTypes) {
    if (!isObject(s.grill.limits[type])) s.grill.limits[type] = {};
    const backlogValue = s.grill.limits[type].backlog;
    const deckValue = s.grill.limits[type].onDeck;
    s.grill.limits[type].backlog = backlogValue === false ? false : clampNumber(backlogValue, 1, 3650, s.grill.defaults.backlog);
    s.grill.limits[type].onDeck = deckValue === false ? false : clampNumber(deckValue, 1, 3650, s.grill.defaults.onDeck);
  }

  if (!isObject(s.design)) s.design = {};
  s.design.accentColor = color(s.design.accentColor);
  s.design.fontScale = fontScale(s.design.fontScale);
  s.design.density = density(s.design.density);
  const oldCards = isObject(s.design.cards) ? { ...s.design.cards } : {};

  if (!isObject(s.design.sourceColors)) s.design.sourceColors = {};
  s.design.sourceColors.plex = color(s.design.sourceColors.plex, DEFAULT_SETTINGS.design.sourceColors.plex);
  s.design.sourceColors.playnite = color(s.design.sourceColors.playnite, DEFAULT_SETTINGS.design.sourceColors.playnite);
  s.design.sourceColors.other = color(s.design.sourceColors.other, DEFAULT_SETTINGS.design.sourceColors.other);

  if (!isObject(s.design.cards)) s.design.cards = {};
  s.design.cards.backdropOpacity = normalizeOpacity(s.design.cards.backdropOpacity, 0.33);
  s.design.cards.backdropBlur = clampNumber(s.design.cards.backdropBlur, 0, 36, 14);
  s.design.cards.overlayOpacity = normalizeOpacity(s.design.cards.overlayOpacity, 0.72);
  s.design.cards.showSourceText = s.design.cards.showSourceText === true;

  if (!isObject(s.design.background)) s.design.background = {};
  s.design.background.rotationSeconds = clampNumber(s.design.background.rotationSeconds, 3, 120, 12);
  s.design.background.opacity = normalizeOpacity(s.design.background.opacity, 0.28);
  s.design.background.blur = clampNumber(s.design.background.blur, 0, 48, 18);
  s.design.background.overlayColor = color(s.design.background.overlayColor, "#05070c");
  s.design.background.overlayOpacity = normalizeOpacity(s.design.background.overlayOpacity, 0.76);
  s.design.background.grayscale = clampNumber(s.design.background.grayscale, 0, 100, 0);
  s.design.background.fadeSeconds = clampNumber(s.design.background.fadeSeconds, 0, 5, 1.2);

  if (!isObject(s.design.itemBackground)) s.design.itemBackground = {};
  if (typeof oldCards !== 'undefined') {
    if (s.design.itemBackground.opacity === undefined && oldCards.backdropOpacity !== undefined) s.design.itemBackground.opacity = oldCards.backdropOpacity;
    if (s.design.itemBackground.blur === undefined && oldCards.backdropBlur !== undefined) s.design.itemBackground.blur = oldCards.backdropBlur;
    if (s.design.itemBackground.overlayOpacity === undefined && oldCards.overlayOpacity !== undefined) s.design.itemBackground.overlayOpacity = oldCards.overlayOpacity;
  }
  s.design.itemBackground.enabled = s.design.itemBackground.enabled !== false;
  s.design.itemBackground.opacity = normalizeOpacity(s.design.itemBackground.opacity, 0.32);
  s.design.itemBackground.blur = clampNumber(s.design.itemBackground.blur, 0, 36, 12);
  s.design.itemBackground.overlayOpacity = normalizeOpacity(s.design.itemBackground.overlayOpacity, 0.72);
  s.design.itemBackground.grayscale = clampNumber(s.design.itemBackground.grayscale, 0, 100, 0);

  const radius = oldCards.radius ?? s.design.cards?.radius;
  const posterRadiusSimple = oldCards.posterRadiusSimple ?? s.design.cards?.posterRadiusSimple;
  const posterRadiusStandard = oldCards.posterRadiusStandard ?? s.design.cards?.posterRadiusStandard;
  s.design.cards = {
    ...s.design.cards,
    radius: clampNumber(radius, 0, 32, 18),
    posterRadiusSimple: clampNumber(posterRadiusSimple, 0, 32, 14),
    posterRadiusStandard: clampNumber(posterRadiusStandard, 0, 32, 12)
  };

  if (!isObject(s.design.itemDetail)) s.design.itemDetail = {};
  if (!isObject(s.design.itemDetail.background)) s.design.itemDetail.background = {};
  if (!["backdrop", "poster", "solid", "none"].includes(s.design.itemDetail.background.background)) s.design.itemDetail.background.background = "backdrop";
  if (!["low", "medium", "high"].includes(s.design.itemDetail.background.shade)) s.design.itemDetail.background.shade = "medium";
  if (!["none", "soft", "strong"].includes(s.design.itemDetail.background.blur)) s.design.itemDetail.background.blur = "soft";
  if (!isObject(s.design.itemDetail.metadataFields)) s.design.itemDetail.metadataFields = DEFAULT_SETTINGS.design.itemDetail.metadataFields;
  for (const key of ["games", "movies", "series"]) {
    if (!Array.isArray(s.design.itemDetail.metadataFields[key])) s.design.itemDetail.metadataFields[key] = DEFAULT_SETTINGS.design.itemDetail.metadataFields[key];
    s.design.itemDetail.metadataFields[key] = s.design.itemDetail.metadataFields[key].filter(value => typeof value === "string" && value.trim()).slice(0, 24);
  }

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
    this.pendingData = this.settings;
    if (this.writeTimer) return;
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      const snapshot = this.pendingData;
      this.writeQueue = this.writeQueue.then(async () => {
        const started = Date.now();
        await fs.writeFile(this.filePath, JSON.stringify(snapshot), "utf8");
        const ms = Date.now() - started;
        if (ms > 250) console.warn(`[persist] settings.json ${ms}ms`);
      }).catch(error => console.error(`[persist] settings.json error:`, error));
    }, Number(process.env.PERSIST_DEBOUNCE_MS || 350));
  }
}
