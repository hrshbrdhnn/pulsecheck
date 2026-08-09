// src/socket.ts
let ws: WebSocket | null = null;
const listeners: Record<string, ((data: any) => void)[]> = {};

function connect() {
  const isHttps = window.location.protocol === 'https:';
  // Use relative path '/ws' so it resolves through the Vite proxy in dev,
  // or goes to the same origin in production.
  const wsUrl = (isHttps ? 'wss://' : 'ws://') + window.location.host + '/ws';
  
  ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      const { type, data } = message;
      if (listeners[type]) {
        listeners[type].forEach(callback => callback(data));
      }
    } catch (err) {
      console.error("Failed to parse WebSocket message:", err);
    }
  };

  ws.onopen = () => {
    console.log("WebSocket connected to FastAPI backend");
    if (listeners['connect']) {
      listeners['connect'].forEach(callback => callback(null));
    }
  };

  ws.onclose = () => {
    console.log("WebSocket disconnected. Reconnecting in 3 seconds...");
    setTimeout(connect, 3000);
  };

  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
    if (listeners['connect_error']) {
      listeners['connect_error'].forEach(callback => callback(err));
    }
  };
}

connect();

const socket = {
  on: (event: string, callback: (data: any) => void) => {
    if (!listeners[event]) {
      listeners[event] = [];
    }
    listeners[event].push(callback);
  },
  off: (event: string, callback?: (data: any) => void) => {
    if (!listeners[event]) return;
    if (!callback) {
      delete listeners[event];
    } else {
      listeners[event] = listeners[event].filter(cb => cb !== callback);
    }
  },
  id: "fastapi-websocket-client"
};

export default socket;
