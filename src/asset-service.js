import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const MIME_EXT = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif"
};

function safeName(value = "asset") {
  return String(value || "asset").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 52) || "asset";
}

function parseDataUri(dataUri) {
  const match = /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,(.+)$/i.exec(String(dataUri || ""));
  if (!match) return null;
  return { mime: match[1].toLowerCase(), buffer: Buffer.from(match[2], "base64") };
}

function extFromUrl(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const ext = path.extname(pathname);
    return [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? (ext === ".jpeg" ? ".jpg" : ext) : "";
  } catch { return ""; }
}

export class AssetService {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.assetsDir = path.join(dataDir, "assets");
  }

  async init() {
    for (const dir of ["wallpapers", "collections", "plex", "playnite", "uploads"]) {
      await fs.mkdir(path.join(this.assetsDir, dir), { recursive: true });
    }
  }

  publicPath(absPath) {
    const relative = path.relative(this.assetsDir, absPath).replaceAll(path.sep, "/");
    return `/assets/${relative}`;
  }

  async saveDataUri(dataUri, { bucket = "uploads", title = "asset" } = {}) {
    const parsed = parseDataUri(dataUri);
    if (!parsed) throw new Error("La imagen debe ser una Data URI válida image/*;base64.");
    const ext = MIME_EXT[parsed.mime] || ".jpg";
    return this.saveBuffer(parsed.buffer, { bucket, title, ext, mime: parsed.mime });
  }

  async saveRemoteUrl(url, { bucket = "uploads", title = "asset" } = {}) {
    if (!/^https?:\/\//i.test(String(url || ""))) throw new Error("URL remota no válida.");
    const response = await fetch(url);
    if (!response.ok) throw new Error(`No se pudo descargar el asset: HTTP ${response.status}`);
    const contentType = String(response.headers.get("content-type") || "").split(";")[0].toLowerCase();
    const ext = MIME_EXT[contentType] || extFromUrl(url) || ".jpg";
    const buffer = Buffer.from(await response.arrayBuffer());
    return this.saveBuffer(buffer, { bucket, title, ext, mime: contentType || "image/jpeg", originalUrl: url });
  }

  async saveExistingAsset(publicPath, { bucket = "uploads", title = "asset" } = {}) {
    const value = String(publicPath || "");
    if (!value.startsWith("/assets/")) throw new Error("Asset local no válido.");
    const rel = value.replace(/^\/assets\//, "");
    const abs = path.resolve(this.assetsDir, rel);
    const root = path.resolve(this.assetsDir);
    if (!abs.startsWith(root)) throw new Error("Ruta de asset fuera del directorio permitido.");
    const buffer = await fs.readFile(abs);
    const ext = path.extname(abs).toLowerCase() || ".jpg";
    const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".gif" ? "image/gif" : "image/jpeg";
    return this.saveBuffer(buffer, { bucket, title, ext, mime, originalUrl: value });
  }

  async saveImage(input, options = {}) {
    const value = String(input || "");
    if (value.startsWith("/assets/")) return this.saveExistingAsset(value, options);
    if (value.startsWith("data:image/")) return this.saveDataUri(value, options);
    if (/^https?:\/\//i.test(value)) return this.saveRemoteUrl(value, options);
    throw new Error("Formato de imagen no admitido. Usa Data URI, URL http(s) o asset local /assets/.");
  }

  async saveBuffer(buffer, { bucket = "uploads", title = "asset", ext = ".jpg", mime = "image/jpeg", originalUrl = null } = {}) {
    if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error("Buffer de imagen vacío.");
    const safeBucket = safeName(bucket);
    const dir = path.join(this.assetsDir, safeBucket);
    await fs.mkdir(dir, { recursive: true });
    const id = crypto.randomUUID();
    const filename = `${Date.now()}-${safeName(title)}-${id}${ext}`;
    const absPath = path.join(dir, filename);
    await fs.writeFile(absPath, buffer);
    return { id, path: this.publicPath(absPath), filePath: absPath, mime, size: buffer.length, originalUrl };
  }

  async removePublicPath(publicPath) {
    if (!publicPath || !String(publicPath).startsWith("/assets/")) return;
    const rel = String(publicPath).replace(/^\/assets\//, "");
    const abs = path.resolve(this.assetsDir, rel);
    if (!abs.startsWith(path.resolve(this.assetsDir))) return;
    try { await fs.unlink(abs); } catch {}
  }
}
