export class RealtimeHub {
  constructor(wss) { this.wss = wss; }
  clientCount() { return this.wss?.clients?.size || 0; }
  send(ws, message) {
    if (ws.readyState !== 1) return;
    const json = JSON.stringify(message);
    ws.send(json);
    return json.length;
  }
  broadcast(message, { trace = false } = {}) {
    const started = Date.now();
    const json = JSON.stringify(message);
    let sent = 0;
    for (const client of this.wss.clients) {
      if (client.readyState === 1) { client.send(json); sent += 1; }
    }
    if (trace || process.env.TRACE_WS === "1") {
      console.log(`[ws:broadcast] type=${message?.type || "unknown"} clients=${sent}/${this.clientCount()} bytes=${json.length} ms=${Date.now() - started}`);
    }
    return { clients: sent, bytes: json.length, ms: Date.now() - started };
  }
}
