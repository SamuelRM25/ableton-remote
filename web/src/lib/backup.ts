/**
 * Full backup of the app's data as one JSON file you keep on your iPad /
 * iCloud / Mac: setlists, BPMs, song/parts tracks, picked parts, Marcas
 * groups, lyrics, pad bindings and preferences.
 *
 * Where the data normally lives (no action needed):
 *   - inside the Live set (song.set_data) — saved when you save the .als;
 *   - in this browser's storage — survives reloads, but not "clear data".
 * The backup file is the copy that survives everything.
 */
import type { Ableton } from "ableton-js";

const PREFIX = "ableton-remote";
/** Docs the app stores inside the Live set. */
const LIVE_KEYS = ["ableton-remote.songconfig.v1", "ableton-remote:setlist"];

export interface BackupFile {
  app: "daw-remote" | "ableton-remote";
  version: 1;
  createdAt: string;
  project: string | null;
  local: Record<string, string>;
  live: Record<string, unknown>;
}

export async function makeBackup(client: Ableton | null): Promise<BackupFile> {
  const local: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      // Connection settings stay per device (each iPad has its own IP/password).
      if (k && k.startsWith(PREFIX) && k !== "ableton-remote.settings.v1") local[k] = localStorage.getItem(k) ?? "";
    }
  } catch {
    // storage unavailable
  }
  const live: Record<string, unknown> = {};
  let project: string | null = null;
  if (client) {
    for (const key of LIVE_KEYS) {
      try {
        const v = await client.song.getData(key);
        if (v !== null && v !== undefined) live[key] = v;
      } catch {
        // not stored in this set
      }
    }
    try {
      project = (await client.song.get("name")) || null;
    } catch {
      project = null;
    }
  }
  return { app: "daw-remote", version: 1, createdAt: new Date().toISOString(), project, local, live };
}

export function downloadBackup(b: BackupFile) {
  const blob = new Blob([JSON.stringify(b, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const d = new Date(b.createdAt);
  const two = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}_${two(d.getHours())}${two(d.getMinutes())}`;
  const name = (b.project || "set").replace(/[^\p{L}\p{N} _-]+/gu, "").trim().replace(/\s+/g, "-") || "set";
  a.href = url;
  a.download = `daw-remote-${name}-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Restores a backup: browser storage + the docs inside the open Live set. */
export async function restoreBackup(client: Ableton | null, text: string): Promise<{ local: number; live: number }> {
  const b = JSON.parse(text) as Partial<BackupFile>;
  if ((b.app !== "daw-remote" && b.app !== "ableton-remote") || typeof b.local !== "object" || !b.local) {
    throw new Error("Ese archivo no es un respaldo de DAW Remote");
  }
  let localCount = 0;
  for (const [k, v] of Object.entries(b.local)) {
    if (!k.startsWith(PREFIX) || typeof v !== "string") continue;
    try {
      localStorage.setItem(k, v);
      localCount++;
    } catch {
      // ignore
    }
  }
  let liveCount = 0;
  if (client && b.live && typeof b.live === "object") {
    for (const [k, v] of Object.entries(b.live)) {
      if (!LIVE_KEYS.includes(k)) continue;
      try {
        await client.song.setData(k, v as any);
        liveCount++;
      } catch {
        // ignore
      }
    }
  }
  return { local: localCount, live: liveCount };
}
