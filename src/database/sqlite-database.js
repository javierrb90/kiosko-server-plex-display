import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const SCHEMA_VERSION = 2;

export class SqliteDatabase {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, "bbqueue.sqlite");
    this.db = null;
  }

  init() {
    fs.mkdirSync(this.dataDir, { recursive: true });
    this.db = new DatabaseSync(this.filePath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA synchronous = NORMAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.migrate();
    return this;
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);
    const current = Number(this.db.prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations").get().version || 0);
    if (current < 1) {
      this.transaction(() => {
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS items (
            id TEXT PRIMARY KEY,
            canonical_id TEXT NOT NULL UNIQUE,
            entity_id TEXT,
            parent_entity_id TEXT,
            source TEXT NOT NULL,
            type TEXT NOT NULL,
            collection_type TEXT NOT NULL,
            title TEXT NOT NULL,
            detail TEXT,
            poster TEXT,
            backdrop TEXT,
            year TEXT,
            rating_key TEXT,
            game_id TEXT,
            rating REAL,
            first_seen_at TEXT,
            last_activity_at TEXT,
            completed_at TEXT,
            status TEXT NOT NULL,
            in_backlog INTEGER NOT NULL DEFAULT 0,
            in_on_deck INTEGER NOT NULL DEFAULT 0,
            completed INTEGER NOT NULL DEFAULT 0,
            charred INTEGER NOT NULL DEFAULT 0,
            turned_at TEXT,
            latest_activity_id TEXT,
            metadata_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT,
            updated_at TEXT NOT NULL,
            deleted_at TEXT
          );
          CREATE INDEX IF NOT EXISTS idx_items_last_activity ON items(last_activity_at DESC);
          CREATE INDEX IF NOT EXISTS idx_items_type ON items(collection_type);
          CREATE INDEX IF NOT EXISTS idx_items_source ON items(source);
          CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
          CREATE INDEX IF NOT EXISTS idx_items_backlog ON items(in_backlog, last_activity_at DESC);
          CREATE INDEX IF NOT EXISTS idx_items_on_deck ON items(in_on_deck, last_activity_at DESC);
          CREATE INDEX IF NOT EXISTS idx_items_completed ON items(completed, completed_at DESC);

          CREATE TABLE IF NOT EXISTS activities (
            id TEXT PRIMARY KEY,
            external_key TEXT NOT NULL,
            item_canonical_id TEXT NOT NULL,
            source TEXT NOT NULL,
            event_type TEXT NOT NULL,
            activity_at TEXT NOT NULL,
            title TEXT,
            subtitle TEXT,
            rating_key TEXT,
            metadata_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL,
            UNIQUE(item_canonical_id, external_key),
            FOREIGN KEY(item_canonical_id) REFERENCES items(canonical_id) ON UPDATE CASCADE ON DELETE CASCADE
          );
          CREATE INDEX IF NOT EXISTS idx_activities_item_date ON activities(item_canonical_id, activity_at DESC);
          CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(activity_at DESC);

          CREATE TABLE IF NOT EXISTS backlog_entries (
            id TEXT PRIMARY KEY,
            item_canonical_id TEXT NOT NULL,
            activity_id TEXT NOT NULL,
            reason TEXT,
            created_at TEXT NOT NULL,
            dismissed_at TEXT,
            UNIQUE(item_canonical_id, activity_id),
            FOREIGN KEY(item_canonical_id) REFERENCES items(canonical_id) ON UPDATE CASCADE ON DELETE CASCADE
          );
          CREATE INDEX IF NOT EXISTS idx_backlog_entries_active ON backlog_entries(dismissed_at, created_at DESC);
        `);
        this.db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(1, new Date().toISOString());
      });
    }
    if (current < 2) {
      this.transaction(() => {
        const columns = new Set(this.db.prepare("PRAGMA table_info(items)").all().map(row => row.name));
        if (!columns.has("subtype")) this.db.exec("ALTER TABLE items ADD COLUMN subtype TEXT");
        if (!columns.has("context")) this.db.exec("ALTER TABLE items ADD COLUMN context TEXT");
        this.db.exec("CREATE INDEX IF NOT EXISTS idx_items_subtype ON items(subtype)");
        this.db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(2, new Date().toISOString());
      });
    }
    if (current > SCHEMA_VERSION) throw new Error(`La base de datos usa un esquema más reciente (${current}) que esta aplicación (${SCHEMA_VERSION}).`);
  }

  transaction(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      try { this.db.exec("ROLLBACK"); } catch {}
      throw error;
    }
  }

  close() {
    this.db?.close();
    this.db = null;
  }

  integrityCheck() {
    return this.db.prepare("PRAGMA quick_check").all().map(row => Object.values(row)[0]);
  }
}
