import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
function first(value) { return Array.isArray(value) ? value[0] : value; }
function value(value) { return value === undefined || value === null ? "" : String(value); }
function pad(value) { return String(value || 0).padStart(2, "0"); }

export class PlexService {
  constructor({ url, token }) { this.setConfig({ url, token }); }
  setConfig({ url, token }) { this.url = url?.replace(/\/$/, "") || ""; this.token = token || ""; }
  isConfigured() { return Boolean(this.url && this.token); }
  assetUrl(path) { return path ? `${this.url}${path}${String(path).includes("?") ? "&" : "?"}X-Plex-Token=${this.token}` : null; }

  async getMetadata(ratingKey) {
    if (!this.isConfigured()) throw new Error("PLEX_URL y PLEX_TOKEN son obligatorios.");
    const response = await fetch(`${this.url}/library/metadata/${ratingKey}?X-Plex-Token=${this.token}`);
    if (!response.ok) throw new Error(`Plex respondió ${response.status} al consultar metadata.`);
    const xml = await response.text();
    const container = parser.parse(xml)?.MediaContainer || {};
    const node = first(container.Video) || first(container.Directory);
    if (!node) throw new Error("Plex no devolvió metadata compatible.");

    const type = value(node.type || (container.viewGroup === "show" ? "show" : "unknown")) || "unknown";
    const rating = value(node.ratingKey || ratingKey);
    const parentRatingKey = value(node.parentRatingKey);
    const grandparentRatingKey = value(node.grandparentRatingKey);
    const isEpisode = type === "episode";
    const isSeason = type === "season";
    const isShow = type === "show";
    const isMovie = type === "movie";

    const posterPath = isEpisode ? (node.grandparentThumb || node.parentThumb || node.thumb) : isSeason ? (node.parentThumb || node.thumb) : node.thumb;
    const backdropPath = node.art || node.grandparentArt || node.parentArt || posterPath;
    const title = isEpisode ? (node.grandparentTitle || node.title) : isSeason ? (node.parentTitle || node.title) : (node.title || "Contenido Plex");
    const subtitle = isEpisode
      ? `${node.title || "Episodio"} · S${pad(node.parentIndex)}E${pad(node.index)}`
      : isSeason
        ? node.title || `Temporada ${node.index || ""}`.trim()
        : (node.tagline || node.librarySectionTitle || "");
    const collectionType = isMovie ? "movies" : (isEpisode || isSeason || isShow ? "series" : "plex");
    const canonicalRatingKey = isEpisode ? (grandparentRatingKey || rating) : isSeason ? (parentRatingKey || rating) : rating;
    const canonicalId = `plex:${collectionType}:${canonicalRatingKey}`;

    return {
      title,
      subtitle,
      year: node.year || "",
      type,
      collectionType,
      ratingKey: rating,
      parentRatingKey: parentRatingKey || null,
      grandparentRatingKey: grandparentRatingKey || null,
      canonicalRatingKey,
      canonicalId,
      posterUrl: this.assetUrl(posterPath),
      backdropUrl: this.assetUrl(backdropPath),
      showTitle: node.grandparentTitle || node.parentTitle || node.title || "",
      showPosterUrl: this.assetUrl(node.grandparentThumb || node.parentThumb || node.thumb),
      showBackdropUrl: this.assetUrl(node.grandparentArt || node.parentArt || node.art),
      raw: node
    };
  }
}
