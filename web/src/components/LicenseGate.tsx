import { useState } from "react";
import { abletonStore } from "../lib/ableton-store";
import { useConnectionStatus, useLicense, useRawAbleton } from "../lib/hooks";
import { BUY_URL, activateKey, startTrial, stateText } from "../lib/product";
import { APP } from "../lib/app-info";
import { LedKey } from "./hw";

const input: React.CSSProperties = {
  width: "100%",
  height: 46,
  padding: "0 14px",
  fontSize: 16,
  borderRadius: 8,
  background: "var(--color-surface-1, #0f1013)",
  color: "var(--color-text-1)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.6)",
  outline: "none",
};

/**
 * Shown over everything when Live is connected but this computer has no
 * valid licence. Activation needs internet once; then it works 30 days
 * offline.
 */
export function LicenseGate() {
  const status = useConnectionStatus();
  const license = useLicense();
  const client = useRawAbleton();
  const trialUsed = license?.plan === "trial";
  const [mode, setMode] = useState<"key" | "trial">(trialUsed ? "key" : "trial");
  const [key, setKey] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status.kind !== "connected" || !license || license.allowed || !client) return null;

  async function submit() {
    if (!client) return;
    setBusy(true);
    setError(null);
    try {
      const next = mode === "key" ? await activateKey(client, key) : await startTrial(client, email);
      abletonStore.getState().setLicense(next);
      if (!next.allowed) setError(next.message || stateText(next));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo activar");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = mode === "key" ? key.trim().length >= 8 : /\S+@\S+\.\S+/.test(email);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-y-auto"
      style={{ background: "color-mix(in srgb, var(--color-bg) 92%, transparent)", backdropFilter: "blur(10px)", zIndex: 110, padding: 16 }}
    >
      <div className="panel-raised" style={{ width: "min(480px, 100%)", padding: 26 }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26, letterSpacing: "0.12em" }}>
          <span style={{ color: "var(--color-accent-cue)" }}>DAW</span> REMOTE
        </div>
        <p style={{ margin: "6px 0 0", color: "var(--color-text-2)", fontSize: 14 }}>
          {license.state === "none" ? "Activa DAW Remote en esta computadora para empezar." : stateText(license)}
          {license.message && license.state !== "none" ? ` — ${license.message}` : ""}
        </p>

        <div className="flex gap-2" style={{ marginTop: 20 }}>
          {!trialUsed && (
            <LedKey size="md" color="play" active={mode === "trial"} label="Probar 14 días gratis" onClick={() => setMode("trial")} />
          )}
          <LedKey size="md" color="cue" active={mode === "key"} label="Tengo una clave" onClick={() => setMode("key")} />
        </div>

        <form
          style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit && !busy) void submit();
          }}
        >
          {mode === "key" ? (
            <>
              <label className="label-cap" style={{ fontSize: 10 }} htmlFor="lic-key">Clave de licencia</label>
              <input
                id="lic-key"
                style={{ ...input, fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
              />
              <span style={{ fontSize: 12, color: "var(--color-text-3)" }}>Te llegó por correo al comprar.</span>
            </>
          ) : (
            <>
              <label className="label-cap" style={{ fontSize: 10 }} htmlFor="lic-mail">Tu correo</label>
              <input
                id="lic-mail"
                type="email"
                style={input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                autoCapitalize="off"
                autoCorrect="off"
              />
              <span style={{ fontSize: 12, color: "var(--color-text-3)" }}>Todas las funciones durante 14 días. Sin tarjeta.</span>
            </>
          )}

          {error && (
            <div role="alert" style={{ fontSize: 13, color: "var(--color-accent-rec)", lineHeight: 1.45 }}>
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-2" style={{ marginTop: 6 }}>
            <button
              type="submit"
              className="tactile"
              disabled={!canSubmit || busy}
              style={{
                height: 46,
                padding: "0 22px",
                fontWeight: 700,
                fontSize: 15,
                color: canSubmit ? "var(--color-accent-play)" : "var(--color-text-3)",
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? "Activando…" : mode === "key" ? "Activar" : "Empezar prueba"}
            </button>
            <a
              href={BUY_URL}
              target="_blank"
              rel="noreferrer"
              className="tactile flex items-center"
              style={{ height: 46, padding: "0 18px", fontSize: 15, color: "var(--color-accent-link)", textDecoration: "none" }}
            >
              Comprar licencia
            </a>
          </div>
        </form>

        <div className="well" style={{ marginTop: 20, padding: "12px 14px", fontSize: 12.5, color: "var(--color-text-2)", lineHeight: 1.55 }}>
          Computadora: <strong style={{ color: "var(--color-text-1)" }}>{license.machine?.name ?? "—"}</strong>
          <br />
          La licencia queda en la computadora donde corre Live. Este dispositivo necesita internet solo para activar;
          después funciona 30 días sin conexión.
        </div>
        <p style={{ margin: "14px 0 0", fontSize: 11.5, color: "var(--color-text-3)" }}>
          v{APP.version} · {APP.company} · {APP.phone}
        </p>
      </div>
    </div>
  );
}
