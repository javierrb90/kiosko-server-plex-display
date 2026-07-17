import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export class JournalStore {
  constructor(dataDir) {
    this.file = path.join(dataDir, 'item-journals.json');
    this.data = { entries: [], reviews: {} };
  }
  async init() {
    try { this.data = { entries: [], reviews: {}, ...JSON.parse(await fs.readFile(this.file, 'utf8')) }; }
    catch { await this.persist(); }
  }
  async persist() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(this.data, null, 2));
  }
  list(itemId, { page = 1, limit = 8 } = {}) {
    const rows = this.data.entries.filter(e => e.itemId === itemId).sort((a,b) => new Date(b.activityAt || b.createdAt) - new Date(a.activityAt || a.createdAt));
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 8));
    const pages = Math.max(1, Math.ceil(rows.length / safeLimit));
    const safePage = Math.max(1, Math.min(pages, Number(page) || 1));
    return { items: rows.slice((safePage-1)*safeLimit, safePage*safeLimit), total: rows.length, page: safePage, pages, limit: safeLimit };
  }
  summary(itemId) {
    const list = this.list(itemId, { page: 1, limit: 1 });
    return { journalCount: list.total, latestJournalEntry: list.items[0] || null, review: this.data.reviews[itemId] || null };
  }
  async add(itemId, input = {}) {
    const now = new Date().toISOString();
    const entry = { id: crypto.randomUUID(), itemId, comment: String(input.comment || '').trim().slice(0,140), image: input.image || null, activityAt: input.activityAt || now, createdAt: now, updatedAt: now };
    if (!entry.comment && !entry.image) return null;
    this.data.entries.push(entry); await this.persist(); return entry;
  }
  async update(itemId, id, input = {}) {
    const entry = this.data.entries.find(e => e.itemId === itemId && e.id === id); if (!entry) return null;
    if ('comment' in input) entry.comment = String(input.comment || '').trim().slice(0,140);
    if ('image' in input) entry.image = input.image || null;
    entry.updatedAt = new Date().toISOString();
    if (!entry.comment && !entry.image) return this.remove(itemId, id);
    await this.persist(); return entry;
  }
  async remove(itemId, id) { const i = this.data.entries.findIndex(e => e.itemId === itemId && e.id === id); if (i < 0) return null; const [entry] = this.data.entries.splice(i,1); await this.persist(); return entry; }
  getReview(itemId) { return this.data.reviews[itemId] || null; }
  async setReview(itemId, input = {}) {
    const previous = this.data.reviews[itemId]; const now = new Date().toISOString();
    const review = { itemId, comment: String(input.comment || '').trim().slice(0,140), image: input.image || null, createdAt: previous?.createdAt || now, updatedAt: now };
    if (!review.comment && !review.image) { delete this.data.reviews[itemId]; await this.persist(); return null; }
    this.data.reviews[itemId] = review; await this.persist(); return review;
  }
  async removeReview(itemId) { const old = this.data.reviews[itemId] || null; delete this.data.reviews[itemId]; await this.persist(); return old; }
  async removeItem(itemId) { this.data.entries = this.data.entries.filter(e => e.itemId !== itemId); delete this.data.reviews[itemId]; await this.persist(); }
}
