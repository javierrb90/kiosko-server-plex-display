import { ViewManager } from "/core/view-manager.js";
import { SocketClient } from "/core/socket-client.js";
import { createPlexView } from "/views/plex-now-playing.js";
import { createNotificationsView } from "/views/notifications.js";
import { createIdleView } from "/views/idle.js";

const views = new ViewManager(document.getElementById("app"));
views.register(createIdleView());
views.register(createPlexView());
views.register(createNotificationsView());

const socket = new SocketClient({
  onMessage(message) {
    if (message.type === "state:snapshot") {
      views.update("plex-now-playing", message.payload.plex);
      views.update("notifications", message.payload.notifications);
      views.show(message.payload.activeView);
    }
    if (message.type === "notification:new") views.notify("notifications", message.payload);
  }
});
socket.connect();
