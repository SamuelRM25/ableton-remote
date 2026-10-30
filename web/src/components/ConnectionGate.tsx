import { useState } from "react";
import { abletonStore } from "../lib/ableton-store";
import { useConnectionStatus, useSettings } from "../lib/hooks";
import { IconArrowRight, IconX } from "./icons";
import { Led } from "./hw";

interface Props {
  onDismiss: () => void;
}

export function ConnectionGate({ onDismiss }: Props) {
  const status = useConnectionStatus();
  const settings = useSettings();
  const [host, setHost] = useState(settings.host);
  const [port, setPort] = useState(String(settings.port));
  const [password, setPassword] = useState(settings.password ?? "");

  // Connected: the LED in the top bar says it all — no card over the music.
  if (status.kind === "connected") return null;

  // While reconnecting on its own, don't throw a modal over the stage.
  if (status.kind === "connecting" || status.kind === "disconnected") {
    return (
      <div
        role="status"
        className="fixed left-1/2 -translate-x-1/2 panel-raised flex items-center gap-3"
        style={{ top: 76, zIndex: 60, padding: "10px 16px" }}
      >
        <Led on color="cue" size={7} blink />
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          {status.kind === "connecting" ? "Conectando con Live…" : "Se perdió la conexión. Reintentando…"}
        </span>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        background: "color-mix(in srgb, var(--color-bg) 85%, transparent)",
        backdropFilter: "blur(8px)",
        zIndex: 100,
      }}
    >
      <div
        className="panel-raised"
        style={{ width: 'min(420px, calc(100vw - 32px))', padding: 24, maxHeight: 'calc(100dvh - 48px)', overflowY: 'auto' }}
      >
        <div className="flex items-center gap-3 mb-6">
          <span
            className="w-3 h-3 rounded-full"
            style={{
              background: "var(--color-accent-cue)",
              boxShadow: "0 0 0 6px color-mix(in srgb, var(--color-accent-cue) 22%, transparent)",
            }}
          />
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "var(--color-text-1)",
              margin: 0,
            }}
          >
            Conectar a Ableton Live
          </h1>
        </div>

        <p
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--color-text-2)",
            marginTop: 0,
            marginBottom: 24,
          }}
        >
          Asegúrate de que Live 12 está abierto, con <code style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-1)" }}>AbletonJS</code> seleccionado como Control Surface en Preferencias → MIDI. Por defecto escucha en <code style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-1)" }}>0.0.0.0:39031</code>.
        </p>

        <div className="flex flex-col gap-4">
          <Field label="Host">
            <input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="w-full well"
              style={{
                height: 40,
                padding: "0 12px",
                color: "var(--color-text-1)",
                fontFamily: "var(--font-mono)",
                fontSize: 14,
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                outline: "none",
              }}
            />
          </Field>

          <Field label="Port">
            <input
              value={port}
              onChange={(e) => setPort(e.target.value)}
              inputMode="numeric"
              className="w-full well"
              style={{
                height: 40,
                padding: "0 12px",
                color: "var(--color-text-1)",
                fontFamily: "var(--font-mono)",
                fontSize: 14,
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                outline: "none",
              }}
            />
          </Field>

          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full well"
              style={{
                height: 40,
                padding: "0 12px",
                color: "var(--color-text-1)",
                fontFamily: "var(--font-mono)",
                fontSize: 14,
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                outline: "none",
              }}
            />
          </Field>
        </div>

        {status.kind === "error" && (
          <div
            className="mt-4 p-3"
            style={{
              background: "color-mix(in srgb, var(--color-critical) 12%, var(--color-surface-2))",
              border: "1px solid var(--color-critical)",
              borderRadius: 8,
              fontSize: 13,
              color: "var(--color-text-1)",
            }}
          >
            {status.message}
          </div>
        )}

        {status.kind === "auth_failed" && (
          <div
            className="mt-4 p-3"
            style={{
              background: "color-mix(in srgb, var(--color-critical) 12%, var(--color-surface-2))",
              border: "1px solid var(--color-critical)",
              borderRadius: 8,
              fontSize: 13,
              color: "var(--color-text-1)",
            }}
          >
            Contraseña incorrecta. Verifica <code style={{ fontFamily: "var(--font-mono)" }}>midi-script/Config.py</code>.
          </div>
        )}

        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={() =>
              abletonStore.getState().setSettings({
                host: host.trim() || "127.0.0.1",
                port: Number(port) || 39031,
                password: password || null,
              })
            }
            className="tactile"
            style={{
              flex: 1,
              height: 48,
              padding: "0 20px",
              background: "var(--color-accent-play)",
              color: "var(--color-text-inverse)",
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 15,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <>
              Conectar <IconArrowRight size={16} />
            </>
          </button>
          <button
            onClick={onDismiss}
            className="tactile"
            style={{
              height: 48,
              padding: "0 18px",
              background: "var(--color-surface-2)",
              color: "var(--color-text-2)",
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 13,
              border: "1px solid var(--color-border)",
            }}
          >
            Continuar offline
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label-cap">{label}</span>
      {children}
    </label>
  );
}
