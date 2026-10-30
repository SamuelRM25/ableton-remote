import { useRef, useState } from "react";
import { useAbleton } from "../lib/hooks";
import { downloadBackup, makeBackup, restoreBackup } from "../lib/backup";
import { toast } from "../lib/toast";
import { LedKey } from "./hw";

/** Export / import every bit of app data as a single JSON file. */
export function BackupPanel({ compact }: { compact?: boolean }) {
  const client = useAbleton();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function exportAll() {
    setBusy(true);
    try {
      downloadBackup(await makeBackup(client));
      toast("Respaldo descargado");
    } catch {
      toast("No se pudo crear el respaldo");
    } finally {
      setBusy(false);
    }
  }

  async function importAll(file: File) {
    setBusy(true);
    try {
      const r = await restoreBackup(client, await file.text());
      toast(`Respaldo restaurado (${r.local} datos${r.live ? ` + ${r.live} en Live` : ""}). Recargando…`);
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo leer el respaldo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {!compact && (
        <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-2)", lineHeight: 1.55 }}>
          Tus setlists, BPMs, pistas, partes, marcas, letras y pads se guardan solos en dos lugares: dentro del
          proyecto de Live (se conservan cuando guardas el set con ⌘S) y en este iPad. El respaldo es un archivo
          con todo, para guardarlo en Archivos/iCloud o pasarlo a otro dispositivo o a otro proyecto.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <LedKey size="md" color="play" active={!busy} disabled={busy} label="Descargar respaldo" onClick={() => void exportAll()} />
        <LedKey size="md" disabled={busy} label="Restaurar respaldo…" onClick={() => fileRef.current?.click()} />
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void importAll(f);
          }}
        />
      </div>
    </div>
  );
}
