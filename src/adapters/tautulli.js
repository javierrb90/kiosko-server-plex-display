function compact(value) {
  return String(value || "unknown").toLowerCase().trim().replace(/[\s_-]+/g, "");
}

export function normalizeTautulliEvent(payload, metadata) {
  const rawEvent = payload.event || payload.event_type || payload.eventType || payload.action || payload.notify_action || "unknown";
  const eventKey = compact(rawEvent);

  // Sólo estos eventos abren el popup temporal de Plex.
  // "resume" se procesa, pero no fuerza navegación automática.
  const playbackStarts = new Set([
    "play", "start", "playbackstart",
    "media.play", "media.playbackstart"
  ]);
  const playbackEnds = new Set([
    "pause", "stop", "playbackpause", "playbackstop", "stopped",
    "media.pause", "media.stop"
  ]);
  const libraryAdded = new Set([
    "recentlyadded", "libraryadded", "added", "mediaadded", "newmedia"
  ]);

  let event = String(rawEvent || "unknown").toLowerCase().trim();
  if (playbackStarts.has(eventKey)) event = "play";
  else if (eventKey === "pause" || eventKey === "playbackpause") event = "pause";
  else if (eventKey === "stop" || eventKey === "playbackstop") event = "stop";
  else if (libraryAdded.has(eventKey)) event = "recently_added";

  return {
    rawEvent: String(rawEvent || "unknown"),
    event,
    startsPlayback: playbackStarts.has(eventKey),
    endsPlayback: playbackEnds.has(eventKey),
    isPlayback: playbackStarts.has(eventKey) || playbackEnds.has(eventKey),
    isLibraryAdded: libraryAdded.has(eventKey),
    plex: { ...metadata, event }
  };
}
