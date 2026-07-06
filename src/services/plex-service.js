import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });

export class PlexService {
  constructor({ url, token }) {
    this.url = url?.replace(/\/$/, "");
    this.token = token;
  }

  isConfigured() { return Boolean(this.url && this.token); }

  assetUrl(path) {
    return path ? `${this.url}${path}${path.includes("?") ? "&" : "?"}X-Plex-Token=${this.token}` : null;
  }

  async getMetadata(ratingKey) {
    if (!this.isConfigured()) throw new Error("PLEX_URL y PLEX_TOKEN son obligatorios.");
    const response = await fetch(`${this.url}/library/metadata/${ratingKey}?X-Plex-Token=${this.token}`);
    if (!response.ok) throw new Error(`Plex respondió ${response.status} al consultar metadata.`);
    const xml = await response.text();
    const video = parser.parse(xml)?.MediaContainer?.Video;
    if (!video) throw new Error("Plex no devolvió metadata de vídeo.");

    const isEpisode = video.type === "episode";
    const posterPath = isEpisode ? (video.grandparentThumb || video.parentThumb || video.thumb) : video.thumb;
    const backdropPath = video.art || video.grandparentArt || video.parentArt || video.thumb || posterPath;
    const title = isEpisode ? (video.grandparentTitle || video.title) : video.title;
    const subtitle = isEpisode
      ? `${video.title || "Episodio"} · S${String(video.parentIndex || 0).padStart(2, "0")}E${String(video.index || 0).padStart(2, "0")}`
      : (video.tagline || "");

    return {
      title,
      subtitle,
      year: video.year || "",
      type: video.type || "unknown",
      ratingKey: String(ratingKey),
      posterUrl: this.assetUrl(posterPath),
      backdropUrl: this.assetUrl(backdropPath)
    };
  }
}
