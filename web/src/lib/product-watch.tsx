import { useEffect } from "react";
import { useLicense, useRawAbleton } from "./hooks";
import { compareVersions, fetchLatest, getUpdateInfo, stateText } from "./product";
import { toast } from "./toast";

const KEY = "daw-remote.lastUpdateCheck";
const DAY_MS = 86_400_000;

/** Once a day per device: tell the musician about a new version or a
 * licence that needs internet soon. Never interrupts anything else. */
export function ProductWatch() {
  const client = useRawAbleton();
  const license = useLicense();

  useEffect(() => {
    if (!client) return;
    let last = 0;
    try {
      last = Number(localStorage.getItem(KEY) || 0);
    } catch {
      // ignore
    }
    if (Date.now() - last < DAY_MS) return;
    const t = window.setTimeout(async () => {
      try {
        const [latest, info] = await Promise.all([fetchLatest(), getUpdateInfo(client)]);
        localStorage.setItem(KEY, String(Date.now()));
        if (compareVersions(latest.version, info.installed) > 0 && info.pending !== latest.version) {
          toast(`DAW Remote ${latest.version} disponible — Ajustes → Actualizaciones`);
        }
      } catch {
        // offline: try again next time
      }
    }, 8000);
    return () => window.clearTimeout(t);
  }, [client]);

  useEffect(() => {
    if (license?.allowed && license.warn && license.valid) toast(stateText(license) + ". Conecta este dispositivo a internet para renovar.");
  }, [license?.warn, license?.valid, license?.allowed]);

  return null;
}
