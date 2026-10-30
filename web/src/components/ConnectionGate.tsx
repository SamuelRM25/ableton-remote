import { useState } from "react";
import { abletonStore } from "../lib/ableton-store";
import { useConnectionStatus, useSettings } from "../lib/hooks";
import { IconArrowRight, IconX } from "./icons";

interface Props {
  onDismiss: () => void;
}

export function ConnectionGate({ onDismiss }: Props) {
  const status = useConnectionStatus();
  const settings = useSettings();
  const [host, setHost] = useState(settings.host);
  const [port, setPort] = useState(String(settings.port));
  const [password, setPassword] = useState(settings.password ?? "");

  if (status.kind === "connected") {
    return (
      <div
        className="fixed bottom-28 right-5 panel-raised px-4 py-3 flex items-center gap-3"
        style={{ zIndex: 10 }}
      >
        <span
          className="w-2 h-2 rounded-full"
          style={{
            background: "var(--color-accent-link)",
            boxShadow:
              "0 0 0 4px color-mix(in srgb, var(--color-accent-link) 22%, transparent)",
          }}
        />
        <span className="label-cap" style={{ color: "var(--color-text-1)" }}>
          Live conectado
        </span>
        <button
          onClick={onDismiss}
          className="tactile"
          style={{
            width: 24,
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-text-3)",
            borderRadius: 6,
          }}
        >
          <IconX size={14} />
        </button>
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
              className="w-full tactile"
              style={{
                height: 40,
                padding: "0 12px",
                background: "var(--color-surface-2)",
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
              className="w-full tactile"
              style={{
                height: 40,
                padding: "0 12px",
                background: "var(--color-surface-2)",
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
              className="w-full tactile"
              style={{
                height: 40,
                padding: "0 12px",
                background: "var(--color-surface-2)",
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
            {status.kind === "connecting" ? (
              <>
                <Spinner /> Conectando…
              </>
            ) : (
              <>
                Conectar <IconArrowRight size={16} />
              </>
            )}
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

function Spinner() {
  return (
    <span
      style={{
        width: 14,
        height: 14,
        borderRadius: "50%",
        border: "2px solid currentColor",
        borderTopColor: "transparent",
        animation: "spin 0.8s linear infinite",
        display: "inline-block",
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </span>
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
