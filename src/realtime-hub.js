export class RealtimeHub {
  constructor(wss) { this.wss = wss; }
  send(ws, message) { if (ws.readyState === 1) ws.send(JSON.stringify(message)); }
  broadcast(message) {
    for (const client of this.wss.clients) this.send(client, message);
  }
}
