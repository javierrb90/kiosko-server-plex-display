import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const MIME_EXT = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/webm": ".webm"
};


const IMAGE_MIMES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function imageProfile({ title = "", bucket = "" } = {}) {
  const key = `${bucket} ${title}`.toLowerCase();
  if (/(backdrop|background|fanart|fondo)/.test(key)) return { width: 1920, height: 1080, quality: 78 };
  if (/(poster|cover|caratula|carátula)/.test(key)) return { width: 1200, height: 1800, quality: 82 };
  return { width: 1600, height: 1600, quality: 80 };
}

async function optimizeImage(buffer, options = {}) {
  const mime = String(options.mime || "").split(";")[0].toLowerCase();
  if (!IMAGE_MIMES.has(mime)) return { buffer, ext: options.ext || extFromMime(mime) || ".jpg", mime: mime || "image/jpeg", optimized: false };
  const profile = imageProfile(options);
  try {
    const output = await sharp(buffer, { failOn: "none" })
      .rotate()
      .resize({ width: profile.width, height: profile.height, fit: "inside", withoutEnlargement: true })
      .webp({ quality: profile.quality, effort: 4, smartSubsample: true })
      .toBuffer();
    return { buffer: output, ext: ".webp", mime: "image/webp", optimized: true };
  } catch {
    return { buffer, ext: options.ext || extFromMime(mime) || ".jpg", mime: mime || "image/jpeg", optimized: false };
  }
}

function safeName(value = "asset") {
  return String(value || "asset").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 52) || "asset";
}

function parseDataUri(dataUri) {
  const match = /^data:((?:image\/(?:jpeg|jpg|png|webp|gif))|(?:video\/(?:mp4|webm)));base64,(.+)$/i.exec(String(dataUri || ""));
  if (!match) return null;
  return { mime: match[1].toLowerCase(), buffer: Buffer.from(match[2], "base64") };
}

function extFromUrl(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const ext = path.extname(pathname);
    return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".webm"].includes(ext) ? (ext === ".jpeg" ? ".jpg" : ext) : "";
  } catch { return ""; }
}

function extFromMime(mime) {
  return MIME_EXT[String(mime || "").split(";")[0].toLowerCase()] || "";
}

async function findCachedFile(dir, prefix) {
  try {
    const entries = await fs.readdir(dir);
    const match = entries.find((entry) => entry.startsWith(prefix));
    return match ? path.join(dir, match) : null;
  } catch {
    return null;
  }
}

export class AssetService {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.assetsDir = path.join(dataDir, "assets");
  }

  async init() {
    for (const dir of ["plex", "playnite", "uploads"]) {
      await fs.mkdir(path.join(this.assetsDir, dir), { recursive: true });
    }
  }

  publicPath(absPath) {
    const relative = path.relative(this.assetsDir, absPath).replaceAll(path.sep, "/");
    return `/assets/${relative}`;
  }

  async saveDataUri(dataUri, { bucket = "uploads", title = "asset" } = {}) {
    const parsed = parseDataUri(dataUri);
    if (!parsed) throw new Error("El archivo debe ser una Data URI válida image/* o video/*;base64.");
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

  async cacheRemoteUrl(url, { bucket = "uploads", title = "asset", cacheKey = null } = {}) {
    const value = String(url || "");
    if (!/^https?:\/\//i.test(value)) throw new Error("URL remota no válida.");

    const safeBucket = safeName(bucket);
    const dir = path.join(this.assetsDir, safeBucket);
    await fs.mkdir(dir, { recursive: true });

    const hash = crypto.createHash("sha1").update(String(cacheKey || value)).digest("hex").slice(0, 24);
    const prefix = `cache-${hash}-`;
    const existing = await findCachedFile(dir, prefix);
    if (existing) {
      const ext = path.extname(existing).toLowerCase();
      const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".gif" ? "image/gif" : "image/jpeg";
      return { id: hash, path: this.publicPath(existing), filePath: existing, mime, size: 0, originalUrl: value, cached: true };
    }

    const response = await fetch(value);
    if (!response.ok) throw new Error(`No se pudo descargar el asset: HTTP ${response.status}`);
    const contentType = String(response.headers.get("content-type") || "").split(";")[0].toLowerCase();
    const sourceExt = extFromMime(contentType) || extFromUrl(value) || ".jpg";
    const sourceBuffer = Buffer.from(await response.arrayBuffer());
    const optimized = await optimizeImage(sourceBuffer, { bucket, title, ext: sourceExt, mime: contentType || "image/jpeg" });
    const filename = `${prefix}${safeName(title)}${optimized.ext}`;
    const absPath = path.join(dir, filename);
    await fs.writeFile(absPath, optimized.buffer);
    return { id: hash, path: this.publicPath(absPath), filePath: absPath, mime: optimized.mime, size: optimized.buffer.length, originalSize: sourceBuffer.length, optimized: optimized.optimized, originalUrl: value, cached: false };
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
    const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".gif" ? "image/gif" : ext === ".mp4" ? "video/mp4" : ext === ".webm" ? "video/webm" : "image/jpeg";
    return this.saveBuffer(buffer, { bucket, title, ext, mime, originalUrl: value });
  }

  async saveImage(input, options = {}) {
    const value = String(input || "");
    if (value.startsWith("/assets/")) return this.saveExistingAsset(value, options);
    if (value.startsWith("data:image/") || value.startsWith("data:video/")) return this.saveDataUri(value, options);
    if (/^https?:\/\//i.test(value)) return this.saveRemoteUrl(value, options);
    throw new Error("Formato de asset no admitido. Usa Data URI, URL http(s) o asset local /assets/.");
  }

  async saveBuffer(buffer, { bucket = "uploads", title = "asset", ext = ".jpg", mime = "image/jpeg", originalUrl = null } = {}) {
    if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error("Buffer de imagen vacío.");
    const safeBucket = safeName(bucket);
    const dir = path.join(this.assetsDir, safeBucket);
    await fs.mkdir(dir, { recursive: true });
    const optimized = await optimizeImage(buffer, { bucket, title, ext, mime });
    const id = crypto.randomUUID();
    const filename = `${Date.now()}-${safeName(title)}-${id}${optimized.ext}`;
    const absPath = path.join(dir, filename);
    await fs.writeFile(absPath, optimized.buffer);
    return { id, path: this.publicPath(absPath), filePath: absPath, mime: optimized.mime, size: optimized.buffer.length, originalSize: buffer.length, optimized: optimized.optimized, originalUrl };
  }

  async removePublicPath(publicPath) {
    if (!publicPath || !String(publicPath).startsWith("/assets/")) return;
    const rel = String(publicPath).replace(/^\/assets\//, "");
    const abs = path.resolve(this.assetsDir, rel);
    if (!abs.startsWith(path.resolve(this.assetsDir))) return;
    try { await fs.unlink(abs); } catch {}
  }
}
