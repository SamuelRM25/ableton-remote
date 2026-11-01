import type { Ableton } from "ableton-js";
import { APP } from "./app-info";

/* ------------------------------------------------------------------ */
/* Server                                                              */
/* ------------------------------------------------------------------ */

const API_KEY = "daw-remote.api";
export const BUY_URL = "https://dawremote.app/#precios";
export const ACCOUNT_URL = "https://cuenta.dawremote.app";

/** api.dawremote.app, or an override for testing (?api=http://…). */
export function apiBase(): string {
  try {
    const q = new URLSearchParams(window.location.search).get("api");
    if (q) localStorage.setItem(API_KEY, q);
    return (localStorage.getItem(API_KEY) || "https://api.dawremote.app").replace(/\/$/, "");
  } catch {
    return "https://api.dawremote.app";
  }
}

async function api<T>(path: string, init?: { body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiBase() + path, {
      method: init?.body !== undefined ? "POST" : "GET",
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new Error("Sin conexión a internet. Conecta el iPad a internet e intenta de nuevo.");
  }
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
  return data as T;
}

/* ------------------------------------------------------------------ */
/* Script commands                                                     */
/* ------------------------------------------------------------------ */

async function cmd<T>(client: Ableton, ns: string, name: string, args: Record<string, unknown> = {}, timeout = 10000): Promise<T> {
  return (await client.sendCommand({ ns, name, args, timeout } as any)) as T;
}

const isMissing = (e: unknown) => /No handler for namespace|doesn't exist/i.test(e instanceof Error ? e.message : String(e));

export type LicenseState = "none" | "trial" | "active" | "expired" | "offline_expired" | "invalid" | "other_machine" | "legacy";

export interface Machine {
  id: string;
  name: string;
  platform: string;
}

export interface LicenseStatus {
  state: LicenseState;
  valid: boolean;
  allowed: boolean;
  required: boolean;
  warn: boolean;
  plan?: string;
  email?: string | null;
  key?: string | null;
  issued?: number;
  refresh_by?: number;
  until?: number | null;
  days_left?: number;
  message?: string;
  machine?: Machine;
}

/** Older scripts have no licence namespace: they keep working as before. */
export async function getLicense(client: Ableton): Promise<LicenseStatus> {
  try {
    return await cmd<LicenseStatus>(client, "license", "get_status");
  } catch (e) {
    if (isMissing(e)) return { state: "legacy", valid: true, allowed: true, required: false, warn: false };
    throw e;
  }
}

async function install(client: Ableton, token: string): Promise<LicenseStatus> {
  return cmd<LicenseStatus>(client, "license", "install_token", { token });
}

export async function activateKey(client: Ableton, key: string): Promise<LicenseStatus> {
  const machine = await cmd<Machine>(client, "license", "get_machine");
  const { token } = await api<{ token: string }>("/v1/activate", { body: { license_key: key.trim(), machine } });
  return install(client, token);
}

export async function startTrial(client: Ableton, email: string): Promise<LicenseStatus> {
  const machine = await cmd<Machine>(client, "license", "get_machine");
  const { token } = await api<{ token: string }>("/v1/trial", { body: { email: email.trim(), machine } });
  return install(client, token);
}

/** Renews the 30-day offline window. Quiet: failures just keep the old token. */
export async function refreshLicense(client: Ableton): Promise<LicenseStatus | null> {
  const token = await cmd<string | null>(client, "license", "get_token").catch(() => null);
  if (!token) return null;
  const { token: next, message } = await api<{ token: string; message?: string }>("/v1/refresh", { body: { token } });
  const s = await install(client, next);
  return message ? { ...s, message } : s;
}

export async function deactivateHere(client: Ableton): Promise<LicenseStatus> {
  const token = await cmd<string | null>(client, "license", "get_token");
  if (token) await api("/v1/deactivate", { body: { token } });
  return cmd<LicenseStatus>(client, "license", "remove");
}

/** Renew when the token is a day old or close to its offline deadline. */
export function needsRefresh(s: LicenseStatus): boolean {
  if (!s.issued || s.state === "legacy" || s.state === "none") return false;
  const age = Date.now() / 1000 - s.issued;
  return age > 20 * 3600 || s.warn || s.state === "offline_expired" || s.state === "expired";
}

export const PLAN_LABEL: Record<string, string> = {
  trial: "Prueba gratis",
  monthly: "Mensual",
  annual: "Anual",
  lifetime: "De por vida",
  founder: "Fundador (de por vida)",
  owner: "Propietario",
};

export function stateText(s: LicenseStatus): string {
  switch (s.state) {
    case "trial":
      return `Prueba gratis · ${s.days_left ?? 0} días restantes`;
    case "active":
      return "Licencia activa";
    case "expired":
      return s.plan === "trial" ? "La prueba gratis terminó" : "La licencia venció";
    case "offline_expired":
      return "Hace más de 30 días que no se verifica la licencia";
    case "other_machine":
      return "La licencia guardada es de otra computadora";
    case "invalid":
      return "La licencia guardada no es válida";
    case "legacy":
      return "Script sin sistema de licencias";
    default:
      return "Sin licencia";
  }
}

/* ------------------------------------------------------------------ */
/* System & updates                                                    */
/* ------------------------------------------------------------------ */

export interface SystemInfo {
  app_version: string;
  protocol: string;
  live_version: string | null;
  machine_name: string;
  platform: string;
  ips: string[];
  port: number;
}

export async function getSystem(client: Ableton): Promise<SystemInfo | null> {
  try {
    return await cmd<SystemInfo>(client, "system", "get_info");
  } catch {
    return null;
  }
}

export interface ReleaseManifest {
  version: string;
  date: string;
  url: string;
  size: number;
  sha256: string;
  signature: string;
  min_live?: string;
  notes?: string;
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = b.split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

export async function getUpdateInfo(client: Ableton): Promise<{ installed: string; pending: string | null }> {
  try {
    const r = await cmd<{ version: string; pending: string | null }>(client, "update", "get_info");
    return { installed: r.version, pending: r.pending };
  } catch {
    return { installed: APP.version, pending: null };
  }
}

export async function fetchLatest(): Promise<ReleaseManifest> {
  return api<ReleaseManifest>("/v1/updates/latest");
}

const CHUNK = 128 * 1024;

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * Downloads the package on this device (it has internet; Live may not) and
 * hands it to the script, which checks the signature and installs it the
 * next time Live starts.
 */
export async function installUpdate(
  client: Ableton,
  m: ReleaseManifest,
  onProgress: (phase: "download" | "send" | "verify", pct: number) => void,
): Promise<string> {
  onProgress("download", 0);
  let res: Response;
  try {
    res = await fetch(m.url, { cache: "no-store" });
  } catch {
    throw new Error("No se pudo descargar la actualización. Revisa la conexión a internet.");
  }
  if (!res.ok || !res.body) throw new Error(`Descarga fallida (${res.status})`);
  const reader = res.body.getReader();
  const buf = new Uint8Array(m.size);
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (got + value.length > m.size) throw new Error("La descarga no coincide con la versión publicada");
    buf.set(value, got);
    got += value.length;
    onProgress("download", got / m.size);
  }
  if (got !== m.size) throw new Error("La descarga quedó incompleta");

  await cmd(client, "update", "begin", { version: m.version, size: m.size, sha256: m.sha256 });
  const total = Math.ceil(m.size / CHUNK);
  try {
    for (let i = 0; i < total; i++) {
      await cmd(client, "update", "chunk", { index: i, data: toBase64(buf.subarray(i * CHUNK, (i + 1) * CHUNK)) }, 20000);
      onProgress("send", (i + 1) / total);
    }
    onProgress("verify", 1);
    return await cmd<string>(client, "update", "finish", { signature: m.signature }, 30000);
  } catch (e) {
    void cmd(client, "update", "cancel").catch(() => {});
    throw e;
  }
}
