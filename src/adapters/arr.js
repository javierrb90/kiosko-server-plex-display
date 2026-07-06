// Punto único de entrada para Sonarr/Radarr. Cada plataforma sólo necesitará
// un adaptador pequeño que devuelva este formato común.
export function normalizeArrEvent(payload, source = "arr") {
  const eventType = String(payload.eventType || payload.event || payload.type || "event").toLowerCase();
  const media = payload.movie || payload.series || payload.episodes?.[0] || {};
  const title = media.title || payload.title || `${source.toUpperCase()} · ${eventType}`;
  return {
    source,
    type: eventType,
    priority: "normal",
    title,
    subtitle: payload.message || payload.release?.releaseTitle || "",
    meta: payload
  };
}
