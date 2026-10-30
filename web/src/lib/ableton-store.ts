import { Ableton } from "ableton-js";
import { createStore } from "./store";
import {
  abletonEndpoint,
  loadSettings,
  saveSettings,
  type AppSettings,
  type ConnectionStatus,
} from "./settings";

/** How often the latency readout in the top bar is refreshed. */
const PING_INTERVAL_MS = 3_000;

/**
 * A command (and ableton-js's own heartbeat) only fails after this long.
 * Live's main thread can freeze for a few seconds while loading a set or a
 * heavy plug-in; with the library default (3 s) that freeze used to look
 * like a dropped connection and forced a full resubscribe. A real network
 * drop is still detected immediately through the socket's close event.
 */
const COMMAND_TIMEOUT_MS = 10_000;

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
let startRetryTimer: number | null = null;
let startRetryDelay = 1000;
let authFailure = false;
/** The client the store currently owns (connected or reconnecting). */
let owned: Ableton | null = null;

function clearStartRetry() {
  if (startRetryTimer !== null) {
    window.clearTimeout(startRetryTimer);
    startRetryTimer = null;
  }
}

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
    clearStartRetry();
    set({ status: { kind: "connecting" }, client: null, latencyMs: null });
    authFailure = false;

    const client = new Ableton({
      host: endpoint.host,
      port: endpoint.port,
      ...(settings.password ? { password: settings.password } : {}),
      connectTimeoutMs: 4_000,
      commandTimeoutMs: COMMAND_TIMEOUT_MS,
      heartbeatInterval: 2_000,
    } as any);
    owned = client;

    // ableton-js reconnects on its own (250 ms → 2 s backoff) after any
    // drop and fires "connect" again; we only mirror its state here.
    client.on("connect", () => {
      if (owned !== client) return;
      startRetryDelay = 1000;
      set({ status: { kind: "connected" }, client });
      startPingLoop(client, (ms) => set({ latencyMs: ms }));
    });

    client.on("disconnect", () => {
      if (owned !== client) return;
      stopPingLoop();
      set({
        status: authFailure ? { kind: "auth_failed" } : { kind: "disconnected" },
        client: null,
        latencyMs: null,
      });
    });

    client.on("error", (err) => {
      if (owned !== client) return;
      const message = err instanceof Error ? err.message : String(err);
      if (/password|auth/i.test(message)) {
        authFailure = true;
        stopPingLoop();
        owned = null;
        void client.close().catch(() => {});
        set({ status: { kind: "auth_failed" }, client: null });
      }
      // Anything else is transient: the library keeps reconnecting.
    });

    try {
      await client.start();
    } catch (err) {
      if (owned !== client) return;
      const message = err instanceof Error ? err.message : "No se pudo conectar a Live";
      if (/password|auth/i.test(message)) authFailure = true;
      // The very first connection never came up: drop this client and try
      // again with a fresh one, backing off gently (1 s → 5 s).
      owned = null;
      void client.close().catch(() => {});
      set({ status: { kind: authFailure ? "auth_failed" : "error", message }, client: null });
      if (!authFailure) {
        startRetryTimer = window.setTimeout(() => {
          startRetryTimer = null;
          void get().connect();
        }, startRetryDelay);
        startRetryDelay = Math.min(5000, startRetryDelay * 2);
      }
    }
  },

  disconnect() {
    clearStartRetry();
    stopPingLoop();
    const client = owned;
    owned = null;
    if (client) void client.close().catch(() => {});
    set({ client: null, status: { kind: "idle" } });
  },

  reconnect() {
    get().disconnect();
    startRetryDelay = 1000;
    void get().connect();
  },
}));

function startPingLoop(client: Ableton, onLatency: (ms: number) => void) {
  stopPingLoop();
  const tick = () => {
    const t0 = performance.now();
    const internal = (client as any).internal;
    const p: Promise<unknown> = internal?.get ? internal.get("ping") : client.application.get("version");
    void p.then(() => onLatency(Math.round(performance.now() - t0))).catch(() => {});
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

/* ------------------------------------------------------------------ */
/* Stage helpers: keep the screen on, recover instantly on wake        */
/* ------------------------------------------------------------------ */

let wakeLock: any = null;

/**
 * Keeps the iPad screen awake while the app is open. When iPadOS dims and
 * locks the screen, Safari freezes the page and the socket dies — the #1
 * cause of "it disconnected" on stage. Safari 16.4+ supports this API.
 */
async function requestWakeLock() {
  try {
    const nav = navigator as any;
    if (!nav.wakeLock || document.visibilityState !== "visible") return;
    if (wakeLock && !wakeLock.released) return;
    wakeLock = await nav.wakeLock.request("screen");
  } catch {
    // Not supported or denied (e.g. low power mode) — nothing else to do.
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    void requestWakeLock();
    // Back from the background: don't wait for the next backoff step.
    const { status, connect } = abletonStore.getState();
    if (status.kind === "error" || status.kind === "disconnected") {
      clearStartRetry();
      if (status.kind === "error") void connect();
    }
  });
  // Wake lock needs a user gesture on some versions: retry on first touch.
  const onFirstTouch = () => void requestWakeLock();
  window.addEventListener("pointerdown", onFirstTouch, { passive: true });
  void requestWakeLock();
}
