
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

function now() { return new Date().toISOString(); }
function clean(value) { return String(value ?? "").trim(); }
function slug(value) {
  return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "grupo";
}
function unique(values = []) {
  return [...new Set((values || []).filter(Boolean).map(String))];
}
function groupSignature(group = {}) {
  const rules = (group.rules || []).map(rule => `${rule.field || ""}:${rule.operator || "contains"}:${String(rule.value || "").toLowerCase().trim()}`).sort().join("|");
  return `${String(group.name || "").toLowerCase().trim()}::${group.mode || "manual"}::${rules}`;
}
function normalizeRule(rule = {}) {
  const field = clean(rule.field || "title");
  const operator = ["equals", "contains"].includes(rule.operator) ? rule.operator : "contains";
  const value = clean(rule.value);
  if (!value) return null;
  return { field, operator, value };
}
function normalizeGroup(input = {}, existing = {}) {
  const date = now();
  const name = clean(input.name || existing.name || "Grupo");
  const mode = ["manual", "dynamic", "mixed"].includes(input.mode || existing.mode) ? (input.mode || existing.mode) : "manual";
  const match = ["all", "any"].includes(input.match || existing.match) ? (input.match || existing.match) : "all";
  const rules = Array.isArray(input.rules) ? input.rules.map(normalizeRule).filter(Boolean) : (existing.rules || []);
  return {
    id: existing.id || input.id || `${slug(name)}-${crypto.randomUUID().slice(0, 8)}`,
    name,
    mode,
    match,
    rules,
    manualItemIds: unique(input.manualItemIds ?? existing.manualItemIds ?? []),
    manualItemKeys: unique(input.manualItemKeys ?? existing.manualItemKeys ?? []),
    excludedItemIds: unique(input.excludedItemIds ?? existing.excludedItemIds ?? []),
    createdAt: existing.createdAt || date,
    updatedAt: date
  };
}

export class CollectionGroupStore {
  constructor(dataDir) {
    this.filePath = path.join(dataDir, "collection-groups.json");
    this.groups = [];
    this.writeQueue = Promise.resolve();
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, "utf8"));
      const normalized = Array.isArray(parsed) ? parsed.map(group => normalizeGroup(group, group)) : [];
      const seen = new Set();
      this.groups = [];
      for (const group of normalized) {
        const signature = groupSignature(group);
        if (seen.has(signature)) continue;
        seen.add(signature);
        this.groups.push(group);
      }
    } catch (error) {
      if (error.code !== "ENOENT") console.error("No se pudieron cargar grupos de colecciones:", error);
    }
  }

  async persist() {
    this.writeQueue = this.writeQueue.then(async () => {
      const started = Date.now();
      await fs.writeFile(this.filePath, JSON.stringify(this.groups), "utf8");
      const ms = Date.now() - started;
      if (ms > 250) console.warn(`[persist] collection-groups.json ${ms}ms`);
    });
    return this.writeQueue;
  }

  list() { return this.groups; }
  get(id) { return this.groups.find(group => group.id === id); }

  async create(input = {}) {
    const group = normalizeGroup(input);
    const signature = groupSignature(group);
    const existing = this.groups.find(entry => groupSignature(entry) === signature);
    if (existing) return existing;
    this.groups.unshift(group);
    await this.persist();
    return group;
  }

  async update(id, patch = {}) {
    const group = this.get(id);
    if (!group) throw new Error("Grupo no encontrado.");
    Object.assign(group, normalizeGroup({ ...group, ...patch }, group), { id: group.id, createdAt: group.createdAt });
    await this.persist();
    return group;
  }

  async remove(id) {
    const index = this.groups.findIndex(group => group.id === id);
    if (index < 0) throw new Error("Grupo no encontrado.");
    const [removed] = this.groups.splice(index, 1);
    await this.persist();
    return removed;
  }

  async addItem(id, itemId, itemKeys = []) {
    const group = this.get(id);
    if (!group) throw new Error("Grupo no encontrado.");
    group.manualItemIds = unique([...(group.manualItemIds || []), itemId]);
    group.manualItemKeys = unique([...(group.manualItemKeys || []), ...itemKeys, itemId]);
    group.excludedItemIds = unique((group.excludedItemIds || []).filter(value => value !== itemId));
    if (group.mode === "dynamic") group.mode = "mixed";
    group.updatedAt = now();
    await this.persist();
    return group;
  }

  async removeItem(id, itemId, { exclude = false, itemKeys = [] } = {}) {
    const group = this.get(id);
    if (!group) throw new Error("Grupo no encontrado.");
    const removalKeys = new Set([itemId, ...(itemKeys || [])].filter(Boolean).map(String));
    group.manualItemIds = unique((group.manualItemIds || []).filter(value => !removalKeys.has(String(value))));
    group.manualItemKeys = unique((group.manualItemKeys || []).filter(value => !removalKeys.has(String(value))));
    if (exclude && group.mode !== "manual") group.excludedItemIds = unique([...(group.excludedItemIds || []), itemId]);
    group.updatedAt = now();
    await this.persist();
    return group;
  }
}
