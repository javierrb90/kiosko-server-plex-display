export class SocketClient {
  constructor({ onMessage, onOpen, onClose, onError }) {
    this.onMessage = onMessage;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.onError = onError;
    this.retry = 1000;
  }

  connect() {
    this.ws = new WebSocket(`ws://${location.host}`);
    this.ws.onmessage = ({ data }) => {
      try {
        this.onMessage(JSON.parse(data));
      } catch (error) {
        console.error("[Kiosko UI] No se ha podido parsear mensaje WebSocket", { data, error });
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
