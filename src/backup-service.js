import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const LIBRARY_BACKUP_FORMAT = 'bbqueue-library-backup';
export const SETTINGS_BACKUP_FORMAT = 'bbqueue-settings-backup';
export const BACKUP_VERSION = 1;

function clone(value) { return JSON.parse(JSON.stringify(value ?? null)); }
function isObject(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function stamp() { return new Date().toISOString(); }
function assertArray(value, name) { if (!Array.isArray(value)) throw new Error(`${name} debe ser una lista.`); }
function assertObject(value, name) { if (!isObject(value)) throw new Error(`${name} debe ser un objeto.`); }

async function walkFiles(root, current = root) {
  const output = [];
  let entries = [];
  try { entries = await fs.readdir(current, { withFileTypes: true }); } catch { return output; }
  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) output.push(...await walkFiles(root, absolute));
    else if (entry.isFile()) output.push({ absolute, relative: path.relative(root, absolute).replaceAll(path.sep, '/') });
  }
  return output;
}

async function exportAssets(dataDir) {
  const root = path.join(dataDir, 'assets');
  const files = await walkFiles(root);
  const assets = [];
  for (const file of files) {
    const buffer = await fs.readFile(file.absolute);
    assets.push({ path: file.relative, bytes: buffer.length, sha256: sha256(buffer), data: buffer.toString('base64') });
  }
  return assets;
}

async function importAssets(dataDir, assets = [], { replace = false } = {}) {
  const root = path.resolve(dataDir, 'assets');
  if (replace) await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(root, { recursive: true });
  let written = 0;
  for (const asset of assets) {
    const relative = String(asset?.path || '').replaceAll('\\', '/').replace(/^\/+/, '');
    if (!relative || relative.includes('..')) throw new Error(`Ruta de asset no válida: ${relative}`);
    const buffer = Buffer.from(String(asset.data || ''), 'base64');
    if (asset.sha256 && sha256(buffer) !== asset.sha256) throw new Error(`El asset ${relative} no supera la verificación de integridad.`);
    const absolute = path.resolve(root, relative);
    if (!absolute.startsWith(root + path.sep)) throw new Error(`Ruta de asset fuera del directorio permitido: ${relative}`);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, buffer);
    written += 1;
  }
  return written;
}

export function validateLibraryBackup(input) {
  assertObject(input, 'El backup');
  if (input.format !== LIBRARY_BACKUP_FORMAT) throw new Error('El archivo no es un backup de biblioteca de BBQueue.');
  if (Number(input.version) !== BACKUP_VERSION) throw new Error(`Versión de backup no compatible: ${input.version}.`);
  assertObject(input.library, 'library');
  assertArray(input.library.items, 'library.items');
  assertArray(input.library.activity, 'library.activity');
  assertArray(input.library.backlogEntries, 'library.backlogEntries');
  assertObject(input.library.backlog, 'library.backlog');
  assertArray(input.library.onDeck, 'library.onDeck');
  assertArray(input.library.completions, 'library.completions');
  assertArray(input.library.groups, 'library.groups');
  assertObject(input.library.journals, 'library.journals');
  if (input.assets !== undefined) assertArray(input.assets, 'assets');
  return input;
}

export function validateSettingsBackup(input) {
  assertObject(input, 'El backup');
  if (input.format !== SETTINGS_BACKUP_FORMAT) throw new Error('El archivo no es un backup de configuración de BBQueue.');
  if (Number(input.version) !== BACKUP_VERSION) throw new Error(`Versión de backup no compatible: ${input.version}.`);
  assertObject(input.settings, 'settings');
  return input;
}

export async function createLibraryBackup({ dataDir, itemRegistryStore, backlogStore, onDeckStore, completionStore, collectionGroupStore, journalStore, includeAssets = true }) {
  const library = {
    items: clone(itemRegistryStore.items || itemRegistryStore.list()),
    activity: clone(itemRegistryStore.activity || []),
    backlogEntries: clone(itemRegistryStore.backlogEntries || []),
    backlog: clone(backlogStore.list()),
    onDeck: clone(onDeckStore.list()),
    completions: clone(completionStore.list()),
    groups: clone(collectionGroupStore.list()),
    journals: clone(journalStore.data || { entries: [], reviews: {} })
  };
  const assets = includeAssets ? await exportAssets(dataDir) : [];
  return {
    format: LIBRARY_BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: 'BBQueue',
    createdAt: stamp(),
    includesAssets: includeAssets,
    summary: {
      items: library.items.filter(item => !item.deletedAt).length,
      activity: library.activity.length,
      backlog: Object.values(library.backlog).reduce((n, rows) => n + (Array.isArray(rows) ? rows.length : 0), 0),
      onDeck: library.onDeck.length,
      completions: library.completions.length,
      groups: library.groups.length,
      journalEntries: library.journals.entries?.length || 0,
      reviews: Object.keys(library.journals.reviews || {}).length,
      assets: assets.length
    },
    library,
    assets
  };
}

function redactSecrets(settings) {
  const output = clone(settings);
  if (output.plex) output.plex.token = '';
  if (output.integrations?.tautulli) output.integrations.tautulli.token = '';
  if (output.integrations?.plex) output.integrations.plex.token = '';
  if (output.integrations?.playnite) output.integrations.playnite.token = '';
  return output;
}

export async function createSettingsBackup({ dataDir, settings, state, includeSecrets = false }) {
  let customCss = '';
  try { customCss = await fs.readFile(path.join(dataDir, 'custom-css', 'global.css'), 'utf8'); } catch {}
  return {
    format: SETTINGS_BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: 'BBQueue',
    createdAt: stamp(),
    includesSecrets: includeSecrets,
    settings: includeSecrets ? clone(settings) : redactSecrets(settings),
    uiState: {
      activeView: state?.activeView || 'backlog',
      selectedCollectionId: state?.selectedCollectionId || null,
      privacyLocked: false
    },
    customCss
  };
}

function mapByCanonical(rows = []) {
  const map = new Map();
  for (const row of rows) map.set(String(row.canonicalId || row.id), row);
  return map;
}
function mergeRows(current = [], incoming = []) {
  const map = mapByCanonical(current);
  for (const row of incoming) map.set(String(row.canonicalId || row.id), row);
  return [...map.values()];
}

export async function applyLibraryBackup({ backup, mode = 'replace', dataDir, itemRegistryStore, backlogStore, onDeckStore, completionStore, collectionGroupStore, journalStore }) {
  validateLibraryBackup(backup);
  const replace = mode !== 'merge';
  const lib = backup.library;
  itemRegistryStore.items = replace ? clone(lib.items) : mergeRows(itemRegistryStore.items, lib.items);
  itemRegistryStore.activity = replace ? clone(lib.activity) : mergeRows(itemRegistryStore.activity, lib.activity);
  itemRegistryStore.backlogEntries = replace ? clone(lib.backlogEntries) : mergeRows(itemRegistryStore.backlogEntries, lib.backlogEntries);
  if (replace) backlogStore.data = clone(lib.backlog);
  else for (const key of Object.keys(lib.backlog)) backlogStore.data[key] = mergeRows(backlogStore.data[key] || [], lib.backlog[key] || []);
  onDeckStore.items = replace ? clone(lib.onDeck) : mergeRows(onDeckStore.items, lib.onDeck);
  completionStore.items = replace ? clone(lib.completions) : mergeRows(completionStore.items, lib.completions);
  collectionGroupStore.groups = replace ? clone(lib.groups) : mergeRows(collectionGroupStore.groups, lib.groups);
  journalStore.data = replace ? clone(lib.journals) : {
    entries: mergeRows(journalStore.data.entries || [], lib.journals.entries || []),
    reviews: { ...(journalStore.data.reviews || {}), ...(lib.journals.reviews || {}) }
  };
  await Promise.all([
    itemRegistryStore.persist(), backlogStore.persist(), onDeckStore.persist(), completionStore.persist(), collectionGroupStore.persist(), journalStore.persist()
  ]);
  const assetsWritten = await importAssets(dataDir, backup.assets || [], { replace });
  return { mode: replace ? 'replace' : 'merge', summary: backup.summary || {}, assetsWritten };
}

export async function clearLibrary({ dataDir, itemRegistryStore, backlogStore, onDeckStore, completionStore, collectionGroupStore, journalStore }) {
  itemRegistryStore.items = []; itemRegistryStore.activity = []; itemRegistryStore.backlogEntries = [];
  backlogStore.data = { plex: [], playnite: [], kiosko: [], manual: [] };
  onDeckStore.items = []; completionStore.items = []; collectionGroupStore.groups = [];
  journalStore.data = { entries: [], reviews: {} };
  await Promise.all([itemRegistryStore.persist(), backlogStore.persist(), onDeckStore.persist(), completionStore.persist(), collectionGroupStore.persist(), journalStore.persist()]);
  await fs.rm(path.join(dataDir, 'assets'), { recursive: true, force: true });
  await fs.mkdir(path.join(dataDir, 'assets'), { recursive: true });
}
