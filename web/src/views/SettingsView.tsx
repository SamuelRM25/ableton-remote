import { useState } from "react";
import { abletonStore } from "../lib/ableton-store";
import { useSettings, useConnectionStatus, useLatency } from "../lib/hooks";
import { DEFAULT_SETTINGS } from "../lib/settings";
import { BackupPanel } from "../components/BackupPanel";

export function SettingsView() {
  const settings = useSettings();
  const status = useConnectionStatus();
  const latency = useLatency();
  const [host, setHost] = useState(settings.host);
  const [port, setPort] = useState(String(settings.port));
  const [password, setPassword] = useState(settings.password ?? "");

  function handleSave() {
    abletonStore.getState().setSettings({
      host: host.trim() || DEFAULT_SETTINGS.host,
      port: Number(port) || DEFAULT_SETTINGS.port,
      password: password || null,
    });
  }

  function handleClearData() {
    if (!confirm("Borrar setlist, lyrics y bindings locales?")) return;
    localStorage.removeItem("ableton-remote.setlist.v1");
    localStorage.removeItem("ableton-remote.lyrics.v1");
    localStorage.removeItem("ableton-remote.pads.v1");
  }

  return (
    <div className="h-full overflow-auto scroll-touch p-4 sm:p-6">
      <div className="max-w-2xl flex flex-col gap-5">
        <Section title="Conexión">
          <Row label="Status">
            <span
              className="value-mono"
              style={{
                fontSize: 12,
                color:
                  status.kind === "connected"
                    ? "var(--color-accent-link)"
                    : "var(--color-accent-rec)",
              }}
            >
              {status.kind}
              {latency !== null && status.kind === "connected" && ` · ${latency}ms`}
            </span>
          </Row>
          <Row label="Host">
            <Input value={host} onChange={setHost} />
          </Row>
          <Row label="Port">
            <Input value={port} onChange={setPort} type="number" />
          </Row>
          <Row label="Password">
            <Input value={password} onChange={setPassword} type="password" />
          </Row>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleSave}
              className="tactile"
              style={{
                height: 40,
                padding: "0 20px",
                background: "var(--color-accent-play)",
                color: "var(--color-text-inverse)",
                fontWeight: 600,
                fontSize: 14,
                borderRadius: 8,
              }}
            >
              Save & reconnect
            </button>
            <button
              onClick={() => abletonStore.getState().reconnect()}
              className="tactile"
              style={{
                height: 40,
                padding: "0 20px",
                background: "var(--color-surface-2)",
                color: "var(--color-text-1)",
                fontWeight: 600,
                fontSize: 14,
                border: "1px solid var(--color-border)",
                borderRadius: 8,
              }}
            >
              Reconnect
            </button>
          </div>
        </Section>

        <Section title="Respaldo de datos">
          <BackupPanel />
        </Section>

        <Section title="Local data">
          <p
            style={{
              fontSize: 13,
              color: "var(--color-text-2)",
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            Setlist, lyrics y bindings de pads se guardan en el localStorage del iPad. Bórralos si quieres empezar de cero.
          </p>
          <button
            onClick={handleClearData}
            className="tactile"
            style={{
              height: 40,
              padding: "0 20px",
              background: "var(--color-surface-2)",
              color: "var(--color-critical)",
              fontWeight: 600,
              fontSize: 13,
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              alignSelf: "flex-start",
              marginTop: 8,
            }}
          >
            Clear local data
          </button>
        </Section>

        <Section title="About">
          <p
            style={{
              fontSize: 13,
              color: "var(--color-text-2)",
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            Ableton Remote · control total de Ableton Live 12 desde el iPad.
            Construido sobre <code style={{ fontFamily: "var(--font-mono)" }}>ableton-js v5</code> + WebSocket nativo.
            <br />
            <br />
            Para tour: instala la build dentro de la carpeta de AbletonJS Remote Script y sirve la UI desde Live.
            Para desarrollo: corre <code style={{ fontFamily: "var(--font-mono)" }}>npm run dev</code> y usa HMR.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel" style={{ padding: 20 }}>
      <h3
        style={{
          fontSize: 11,
          fontFamily: "var(--font-mono)",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--color-text-3)",
          margin: 0,
          marginBottom: 16,
        }}
      >
        {title}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <span
        className="label-cap"
        style={{ width: 80, flexShrink: 0 }}
      >
        {label}
      </span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Input({
  value,
  onChange,
  type,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        height: 40,
        padding: "0 12px",
        background: "var(--color-surface-2)",
        color: "var(--color-text-1)",
        fontFamily: type === "password" ? "var(--font-mono)" : "var(--font-sans)",
        fontSize: 14,
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        outline: "none",
      }}
    />
  );
}
