import { Ableton } from "ableton-js";
import { createStore } from "./store";
import {
  abletonEndpoint,
  loadSettings,
  saveSettings,
  type AppSettings,
  type ConnectionStatus,
} from "./settings";

const PING_INTERVAL_MS = 10_000;

export interface AbletonStore {
  settings: AppSettings;
  status: ConnectionStatus;
  client: Ableton | null;
  latencyMs: number | null;
  setSettings(next: AppSettings): void;
  connect(): Promise<void>;
  disconnect(): void;
  reconnect(): void;
}

let pingTimer: number | null = null;
let reconnectTimer: number | null = null;
let reconnectDelay = 1500;
/** Set when the user (or settings change) closes the socket on purpose. */
let manualClose = false;

function clearReconnect() {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

/**
 * On stage the WiFi can blink. Instead of waiting for someone to press
 * "Retry", reconnect on our own with a gentle backoff (1.5 s → 8 s).
 */
function scheduleReconnect(connect: () => Promise<void>) {
  if (manualClose || authFailure) return;
  clearReconnect();
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    void connect();
  }, reconnectDelay);
  reconnectDelay = Math.min(8000, Math.round(reconnectDelay * 1.6));
}
let lastPingSentAt = 0;
let authFailure = false;

export const abletonStore = createStore<AbletonStore>((set, get) => ({
  settings: loadSettings(),
  status: { kind: "idle" },
  client: null,
  latencyMs: null,

  setSettings(next) {
    saveSettings(next);
    set({ settings: next });
    get().reconnect();
  },

  async connect() {
    const { settings } = get();
    const endpoint = abletonEndpoint();
    set({ status: { kind: "connecting" }, client: null, latencyMs: null });
    authFailure = false;
    manualClose = false;
    clearReconnect();

    const client = new Ableton({
      host: endpoint.host,
      port: endpoint.port,
      ...(settings.password ? { password: settings.password } : {}),
      connectTimeoutMs: 6_000,
    });

    client.on("connect", () => {
      reconnectDelay = 1500;
      set({ status: { kind: "connected" }, client });
      startPingLoop(client, (ms) => set({ latencyMs: ms }));
    });

    client.on("disconnect", () => {
      stopPingLoop();
      const current = get().client;
      if (current === client) {
        if (authFailure) {
          set({ status: { kind: "auth_failed" }, client: null });
        } else {
          set({ status: { kind: "disconnected" }, client: null });
          scheduleReconnect(get().connect);
        }
      }
    });

    client.on("error", (err) => {
      // Authentication errors and other unrecoverable issues come through here.
      const message = err instanceof Error ? err.message : String(err);
      if (/password|auth/i.test(message)) {
        authFailure = true;
      }
      stopPingLoop();
      if (get().client !== client && get().status.kind !== "connecting") return;
      set({
        status: { kind: authFailure ? "auth_failed" : "error", message },
        client: null,
      });
      scheduleReconnect(get().connect);
    });

    try {
      await client.start();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo conectar a Live";
      if (/password|auth/i.test(message)) authFailure = true;
      set({ status: { kind: authFailure ? "auth_failed" : "error", message }, client: null });
      scheduleReconnect(get().connect);
    }
  },

  disconnect() {
    manualClose = true;
    clearReconnect();
    const { client } = get();
    if (client) {
      void client.close();
    }
    stopPingLoop();
    set({ client: null, status: { kind: "idle" } });
  },

  reconnect() {
    get().disconnect();
    reconnectDelay = 1500;
    void get().connect();
  },
}));

function startPingLoop(client: Ableton, onLatency: (ms: number) => void) {
  stopPingLoop();
  const tick = () => {
    lastPingSentAt = performance.now();
    void client.application
      .get("version")
      .then(() => {
        onLatency(Math.round(performance.now() - lastPingSentAt));
      })
      .catch(() => {});
  };
  pingTimer = window.setInterval(tick, PING_INTERVAL_MS);
  tick();
}

function stopPingLoop() {
  if (pingTimer !== null) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}
