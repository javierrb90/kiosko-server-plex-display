export class SocketClient {
  constructor({ onMessage, onOpen, onClose, onError }) {
    this.onMessage = onMessage;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.onError = onError;
    this.retry = 1000;
  }

  buildUrl() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}`;
  }

  connect() {
    this.ws = new WebSocket(this.buildUrl());
    this.ws.onmessage = ({ data }) => {
      try {
        this.onMessage(JSON.parse(data));
      } catch (error) {
        console.error("[BBQueue UI] No se ha podido parsear mensaje WebSocket", { data, error });
      }
    };
    this.ws.onopen = () => {
      this.retry = 1000;
      this.onOpen?.();
    };
    this.ws.onerror = event => this.onError?.(event);
    this.ws.onclose = () => {
      this.onClose?.();
      setTimeout(() => this.connect(), this.retry);
      this.retry = Math.min(this.retry * 1.6, 10000);
    };
  }
}
