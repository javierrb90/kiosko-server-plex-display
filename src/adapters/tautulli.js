export function normalizeTautulliEvent(payload, metadata) {
  const rawEvent = String(payload.event || payload.event_type || "unknown").toLowerCase();
  const event = rawEvent === "resume" ? "play" : rawEvent;
  return {
    event,
    isPlayback: ["play", "pause", "stop"].includes(event),
    isLibraryAdded: ["recently_added", "library_added", "added"].includes(event),
    plex: { ...metadata, event }
  };
}
