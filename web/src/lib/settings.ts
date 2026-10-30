export type ConnectionStatus =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "connected" }
  | { kind: "auth_required" }
  | { kind: "auth_failed" }
  | { kind: "disconnected" }
  | { kind: "error"; message: string };

export interface AppSettings {
  host: string;
  port: number;
  password: string | null;
}

const STORAGE_KEY = "ableton-remote.settings.v1";

export const DEFAULT_SETTINGS: AppSettings = {
  host: "127.0.0.1",
  port: 39031,
  password: "ableton",
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // First-time user: use the host the page was served from. On a LAN
      // connection, that's the Mac's IP, which is what we want.
      return {
        ...DEFAULT_SETTINGS,
        host:
          typeof window !== "undefined"
            ? window.location.hostname || DEFAULT_SETTINGS.host
            : DEFAULT_SETTINGS.host,
      };
    }
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      host: parsed.host ?? DEFAULT_SETTINGS.host,
      port: parsed.port ?? DEFAULT_SETTINGS.port,
      password: parsed.password ?? DEFAULT_SETTINGS.password,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/**
 * Returns host:port for the ableton-js client to connect to. We always
 * use the origin that served the SPA so the WebSocket is on the same
 * origin (the WS bridge in dev, Live's static server in prod).
 */
export function abletonEndpoint(): { host: string; port: number } {
  // In dev, the page is served by Vite on :5173, and ableton-ws-bridge
  // forwards WS upgrades to 39031. The client must use 5173 here.
  // In prod, Live's static server serves the SPA on :39031 too.
  return {
    host: window.location.hostname,
    port: import.meta.env.DEV ? 5173 : Number(window.location.port || 39031),
  };
}
