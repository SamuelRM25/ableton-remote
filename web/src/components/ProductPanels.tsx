import { useEffect, useMemo, useState } from "react";
import qrcode from "qrcode-generator";
import { abletonStore } from "../lib/ableton-store";
import { useAbleton, useLicense, useLiveProp, useRawAbleton } from "../lib/hooks";
import {
  ACCOUNT_URL,
  BUY_URL,
  PLAN_LABEL,
  compareVersions,
  deactivateHere,
  fetchLatest,
  getSystem,
  getUpdateInfo,
  installUpdate,
  refreshLicense,
  stateText,
  type ReleaseManifest,
  type SystemInfo,
} from "../lib/product";
import { toast } from "../lib/toast";
import { Led, LedKey } from "./hw";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel" style={{ padding: 20 }}>
      <h3 className="label-cap" style={{ fontSize: 11, margin: "0 0 14px" }}>{title}</h3>
      {children}
    </div>
  );
}

function Grid({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <div className="well" style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", fontSize: 13 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <span className="label-cap" style={{ fontSize: 10, alignSelf: "center" }}>{k}</span>
          <span style={{ color: "var(--color-text-1)", minWidth: 0, overflowWrap: "anywhere" }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

const fmtDate = (t?: number | null) =>
  t ? new Date(t * 1000).toLocaleDateString("es-GT", { day: "numeric", month: "short", year: "numeric" }) : "—";

/* ------------------------------------------------------------------ */

export function LicensePanel() {
  const license = useLicense();
  const client = useRawAbleton();
  const [busy, setBusy] = useState<string | null>(null);

  if (!license || license.state === "legacy") return null;

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo completar");
    } finally {
      setBusy(null);
    }
  }

  const ok = license.valid;
  return (
    <Panel title="Licencia">
      <div className="flex items-center gap-2.5" style={{ marginBottom: 12 }}>
        <Led on color={ok ? (license.warn ? "cue" : "play") : "critical"} size={8} />
        <span style={{ fontSize: 15, fontWeight: 600 }}>{stateText(license)}</span>
      </div>
      <Grid
        rows={[
          ["Plan", PLAN_LABEL[license.plan ?? ""] ?? "—"],
          ["Correo", license.email || "—"],
          ["Clave", license.key ? `••••${license.key}` : "—"],
          ["Vence", license.until ? fmtDate(license.until) : license.plan ? "Nunca" : "—"],
          ["Verificar antes de", fmtDate(license.refresh_by)],
          ["Computadora", license.machine?.name ?? "—"],
        ]}
      />
      {license.warn && ok && (
        <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--color-accent-cue)" }}>
          Conecta este dispositivo a internet unos segundos para renovar la verificación.
        </p>
      )}
      <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--color-text-3)", lineHeight: 1.5 }}>
        Si la licencia vence durante un show, la app sigue funcionando hasta que cierres Live.
      </p>
      <div className="flex flex-wrap gap-2" style={{ marginTop: 14 }}>
        <LedKey
          size="md"
          color="play"
          disabled={!client || !!busy}
          label={busy === "refresh" ? "Verificando…" : "Verificar ahora"}
          onClick={() =>
            client &&
            void run("refresh", async () => {
              const s = await refreshLicense(client);
              if (s) abletonStore.getState().setLicense(s);
              toast(s?.message || "Licencia verificada");
            })
          }
        />
        {license.plan === "trial" || !ok ? (
          <a href={BUY_URL} target="_blank" rel="noreferrer" className="tactile flex items-center" style={{ height: 40, padding: "0 16px", color: "var(--color-accent-link)", textDecoration: "none", fontSize: 14 }}>
            Comprar licencia
          </a>
        ) : (
          <a href={ACCOUNT_URL} target="_blank" rel="noreferrer" className="tactile flex items-center" style={{ height: 40, padding: "0 16px", color: "var(--color-accent-link)", textDecoration: "none", fontSize: 14 }}>
            Mi cuenta
          </a>
        )}
        {license.plan && license.plan !== "trial" && (
          <LedKey
            size="md"
            disabled={!client || !!busy}
            label={busy === "off" ? "Desactivando…" : "Desactivar esta computadora"}
            onClick={() => {
              if (!client) return;
              if (!confirm("¿Liberar la licencia de esta computadora? Podrás activarla en otra. Aquí seguirá funcionando hasta que cierres Live.")) return;
              void run("off", async () => {
                abletonStore.getState().setLicense(await deactivateHere(client));
                toast("Computadora desactivada");
              });
            }}
          />
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */

export function UpdatePanel() {
  const client = useRawAbleton();
  const licensed = useAbleton();
  const isPlaying = !!useLiveProp<boolean>(licensed, (c) => c.song, "is_playing");
  const [sys, setSys] = useState<SystemInfo | null>(null);
  const [info, setInfo] = useState<{ installed: string; pending: string | null } | null>(null);
  const [latest, setLatest] = useState<ReleaseManifest | null>(null);
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    void getSystem(client).then(setSys);
    void getUpdateInfo(client).then(setInfo);
  }, [client]);

  async function check() {
    setChecking(true);
    setError(null);
    try {
      setLatest(await fetchLatest());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo buscar");
    } finally {
      setChecking(false);
    }
  }

  async function install() {
    if (!client || !latest) return;
    setError(null);
    try {
      const v = await installUpdate(client, latest, (phase, pct) =>
        setProgress(phase === "download" ? `Descargando ${Math.round(pct * 100)}%` : phase === "send" ? `Copiando a la computadora ${Math.round(pct * 100)}%` : "Verificando firma…"),
      );
      setInfo(await getUpdateInfo(client));
      toast(`Versión ${v} lista. Reinicia Live para aplicarla.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo instalar");
    } finally {
      setProgress(null);
    }
  }

  const installed = info?.installed ?? sys?.app_version;
  const newer = latest && installed ? compareVersions(latest.version, installed) > 0 : false;
  const alreadyPending = !!latest && info?.pending === latest.version;

  return (
    <Panel title="Actualizaciones">
      <Grid
        rows={[
          ["Instalada", installed ? `v${installed}` : "—"],
          ["Ableton Live", sys?.live_version ?? "—"],
          ["Computadora", sys ? `${sys.machine_name} · ${sys.platform === "mac" ? "macOS" : sys.platform === "windows" ? "Windows" : sys.platform}` : "—"],
          ...(info?.pending ? ([["Lista para instalar", `v${info.pending} — se aplica al reiniciar Live`]] as [string, string][]) : []),
        ]}
      />
      <div className="flex flex-wrap items-center gap-2" style={{ marginTop: 14 }}>
        <LedKey size="md" color="cue" disabled={!client || checking || !!progress} label={checking ? "Buscando…" : "Buscar actualizaciones"} onClick={() => void check()} />
        {newer && !alreadyPending && (
          <LedKey
            size="md"
            color="play"
            active
            disabled={!!progress || isPlaying}
            label={progress ?? `Instalar v${latest!.version}`}
            onClick={() => void install()}
          />
        )}
      </div>
      {latest && !newer && <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--color-text-2)" }}>Tienes la versión más reciente.</p>}
      {newer && isPlaying && !progress && (
        <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--color-accent-cue)" }}>Detén la reproducción para instalar.</p>
      )}
      {newer && latest?.notes && (
        <details style={{ marginTop: 10, fontSize: 12.5, color: "var(--color-text-2)" }}>
          <summary style={{ cursor: "pointer" }}>Novedades de v{latest.version}</summary>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: "8px 0 0", lineHeight: 1.5 }}>{latest.notes}</pre>
        </details>
      )}
      {error && <p role="alert" style={{ margin: "10px 0 0", fontSize: 13, color: "var(--color-accent-rec)" }}>{error}</p>}
      <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--color-text-3)", lineHeight: 1.5 }}>
        La actualización se descarga en este dispositivo, la computadora verifica que esté firmada por DAW Remote y se
        aplica la próxima vez que abras Live. Nunca cambia nada a mitad de un show.
      </p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */

function Qr({ text, size = 156 }: { text: string; size?: number }) {
  const svg = useMemo(() => {
    const q = qrcode(0, "M");
    q.addData(text);
    q.make();
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }, [text]);
  return (
    <div
      aria-label={`Código QR de ${text}`}
      style={{ width: size, height: size, background: "#fff", borderRadius: 10, padding: 6, flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function ConnectPanel() {
  const client = useRawAbleton();
  const [sys, setSys] = useState<SystemInfo | null>(null);
  useEffect(() => {
    if (client) void getSystem(client).then(setSys);
  }, [client]);

  const page = window.location;
  const host = sys?.ips[0] && /^(localhost|127\.)/.test(page.hostname) ? sys.ips[0] : page.hostname;
  const port = sys?.port ?? (Number(page.port) || 39031);
  const url = `http://${host}:${port}/`;

  return (
    <Panel title="Conectar otro dispositivo">
      <div className="flex flex-wrap gap-5 items-center">
        <Qr text={url} />
        <div style={{ minWidth: 200, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-text-2)", lineHeight: 1.55 }}>
            Escanea con la cámara del iPad o del teléfono (en el mismo WiFi), o escribe:
          </p>
          <div className="value-mono" style={{ fontSize: 18, margin: "8px 0", color: "var(--color-text-1)" }}>{url}</div>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--color-text-3)", lineHeight: 1.5 }}>
            Pantalla de escenario para otro dispositivo: <span className="value-mono">{url}#escenario</span>
            {sys && sys.ips.length > 1 && (
              <>
                <br />
                Otras direcciones de esta computadora: {sys.ips.slice(1).join(", ")}
              </>
            )}
          </p>
        </div>
      </div>
    </Panel>
  );
}
