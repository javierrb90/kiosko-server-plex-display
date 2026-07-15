function asList(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(item => String(item).trim()).filter(Boolean);
  if (value === null || value === undefined || value === "") return [];
  return [String(value).trim()].filter(Boolean);
}

function validDataUri(value) {
  if (typeof value !== "string" || !value) return null;
  // Playnite envía imágenes autocontenidas como data:image/*;base64,...
  // Sólo se admiten formatos gráficos habituales para evitar contenido inesperado.
  return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value) ? value : null;
}

export function normalizePlayniteEvent(payload = {}) {
  const title = String(payload.title || payload.name || "Juego sin título").trim() || "Juego sin título";
  const platforms = asList(payload.platforms);
  const developers = asList(payload.developers);
  const publishers = asList(payload.publishers);
  const genres = asList(payload.genres);
  const releaseYear = payload.releaseYear ?? payload.year ?? "";
  const playtime = payload.playtime ?? null;
  const gameId = payload.id || payload.gameId || payload.databaseId || payload.sourceId || title;

  return {
    event: "game_started",
    title,
    gameId: String(gameId || title),
    platforms,
    developers,
    publishers,
    genres,
    releaseYear: releaseYear ? String(releaseYear) : "",
    playtime,
    cover: validDataUri(payload.cover),
    background: validDataUri(payload.background),
    receivedAt: new Date().toISOString(),
    raw: payload
  };
}
