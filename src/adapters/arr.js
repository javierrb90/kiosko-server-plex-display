/**
 * Normaliza los payloads nativos de los webhooks de Sonarr y Radarr.
 * Eventos admitidos:
 * - Radarr: Grab, MovieAdded
 * - Sonarr: Grab, SeriesAdded
 *
 * Los nombres varían levemente entre versiones/configuraciones, por eso se
 * aceptan sus equivalentes compactos: movieadd, movieadded, seriesadd,
 * seriesadded.
 */
const SUPPORTED_EVENTS = {
  radarr: new Map([
    ["grab", "grab"],
    ["movieadd", "movie_added"],
    ["movieadded", "movie_added"]
  ]),
  sonarr: new Map([
    ["grab", "grab"],
    ["seriesadd", "series_added"],
    ["seriesadded", "series_added"]
  ])
};

function compact(value) {
  return String(value || "").toLowerCase().replace(/[\s_-]+/g, "");
}

function findImage(media, preferredTypes = []) {
  const images = Array.isArray(media?.images) ? media.images : [];
  for (const coverType of preferredTypes) {
    const image = images.find(item => String(item?.coverType || "").toLowerCase() === coverType);
    if (image?.remoteUrl) return image.remoteUrl;
    if (image?.url) return image.url;
  }
  const fallback = images.find(item => item?.remoteUrl || item?.url);
  return fallback?.remoteUrl || fallback?.url || null;
}

function getMedia(payload, source) {
  if (source === "radarr") return payload.movie || {};
  return payload.series || payload.episode?.series || payload.episodes?.[0]?.series || {};
}

function getEpisodeLabel(payload) {
  const episodes = Array.isArray(payload.episodes) ? payload.episodes : [];
  const episode = payload.episode || episodes[0];
  if (!episode) return "";
  const season = Number.isFinite(Number(episode.seasonNumber)) ? `S${String(episode.seasonNumber).padStart(2, "0")}` : "";
  const number = Number.isFinite(Number(episode.episodeNumber)) ? `E${String(episode.episodeNumber).padStart(2, "0")}` : "";
  return [season + number, episode.title].filter(Boolean).join(" · ");
}

function releaseTitle(payload) {
  return payload.release?.releaseTitle || payload.releaseTitle || payload.release?.title || "";
}

export function normalizeArrEvent(payload, source = "arr") {
  const normalizedSource = String(source || "").toLowerCase();
  if (!SUPPORTED_EVENTS[normalizedSource]) {
    throw new Error("La fuente ARR debe ser sonarr o radarr.");
  }

  const rawEvent = payload.eventType || payload.event || payload.type || "";
  const event = SUPPORTED_EVENTS[normalizedSource].get(compact(rawEvent));
  if (!event) {
    throw new Error(`Evento no admitido de ${normalizedSource}: ${rawEvent || "sin eventType"}.`);
  }

  const media = getMedia(payload, normalizedSource);
  const isRadarr = normalizedSource === "radarr";
  const title = media.title || payload.title || (isRadarr ? "Película" : "Serie");
  const year = media.year ? String(media.year) : "";
  const poster = findImage(media, ["poster", "cover"]);
  const backdrop = findImage(media, ["fanart", "background", "banner", "poster", "cover"]);

  let subtitle = "";
  if (event === "grab") {
    subtitle = isRadarr
      ? ["Descarga iniciada", releaseTitle(payload)].filter(Boolean).join(" · ")
      : ["Descarga iniciada", getEpisodeLabel(payload), releaseTitle(payload)].filter(Boolean).join(" · ");
  } else if (event === "movie_added") {
    subtitle = ["Añadida a Radarr", year].filter(Boolean).join(" · ");
  } else {
    subtitle = ["Añadida a Sonarr", year].filter(Boolean).join(" · ");
  }

  return {
    source: normalizedSource,
    type: event,
    priority: event === "grab" ? "high" : "normal",
    title,
    subtitle,
    image: poster,
    backdrop,
    meta: {
      eventType: rawEvent,
      tmdbId: media.tmdbId || null,
      tvdbId: media.tvdbId || null,
      year: media.year || null,
      releaseTitle: releaseTitle(payload) || null,
      raw: payload
    }
  };
}
