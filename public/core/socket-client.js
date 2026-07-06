export class SocketClient {
  constructor({ onMessage }) { this.onMessage = onMessage; this.retry = 1000; }
  connect() {
    this.ws = new WebSocket(`ws://${location.host}`);
    this.ws.onmessage = ({ data }) => this.onMessage(JSON.parse(data));
    this.ws.onopen = () => { this.retry = 1000; };
    this.ws.onclose = () => setTimeout(() => this.connect(), this.retry = Math.min(this.retry * 1.6, 10000));
  }
}
