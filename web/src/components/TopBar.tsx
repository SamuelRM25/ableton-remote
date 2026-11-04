import { useEffect } from "react";
import { abletonStore } from "../lib/ableton-store";
import { useAbleton, useConnectionStatus, useLiveProp, useLatency } from "../lib/hooks";
import { useSongClock } from "../lib/clock";
import { Led, Meter } from "./hw";
import { LogoMark } from "./Logo";

interface Props {
  view: string;
}

/**
 * Header: connection LED on the left, the VFD display window in the
 * middle (position, signature, project, transport state), CPU on the right.
 */
export function TopBar({ view }: Props) {
  const status = useConnectionStatus();
  const client = useAbleton();
  const latency = useLatency();
  // song.name has no listener in Live — poll slowly instead.
  const projectName = useLiveProp<string>(client, (c) => c.song, "name", {
    listen: false,
    pollMs: 2000,
  });
  const clock = useSongClock(client);
  const recording = !!useLiveProp<boolean>(client, (c) => c.song, "record_mode");
  const countingIn = !!useLiveProp<boolean>(client, (c) => c.song, "is_counting_in");
  // Live reports this in percent (0–100), not as a 0–1 fraction.
  const cpuPct = useLiveProp<number>(client, (c) => c.application, "average_process_usage", {
    listen: false,
    pollMs: 1000,
  });
  const cpu = cpuPct === undefined ? undefined : Math.max(0, Math.min(1, cpuPct / 100));

  // Beat-synced CSS animations follow Live's tempo.
  useEffect(() => {
    if (!clock.tempo) return;
    document.documentElement.style.setProperty("--beat-duration", `${60 / clock.tempo}s`);
  }, [clock.tempo]);

  const conn = (() => {
    switch (status.kind) {
      case "connected":
        return { label: "Live", color: "play", on: true };
      case "connecting":
        return { label: "Conectando", color: "cue", on: true };
      case "auth_required":
      case "auth_failed":
        return { label: "Contraseña", color: "critical", on: true };
      case "error":
        return { label: "Sin Live", color: "critical", on: true };
      case "disconnected":
        return { label: "Desconectado", color: "critical", on: true };
      default:
        return { label: "Inactivo", color: "white", on: false };
    }
  })();

  const connected = status.kind === "connected";

  return (
    <header
      className="shrink-0 flex items-center px-3 sm:px-4 gap-3 sm:gap-4 pt-safe"
      style={{
        minHeight: 64,
        background:
          "linear-gradient(180deg, #202226 0%, #191a1e 100%)",
        borderBottom: "1px solid rgba(0,0,0,0.85)",
        boxShadow: "inset 0 -1px 0 rgba(255,255,255,0.04), 0 6px 18px rgba(0,0,0,0.35)",
      }}
    >
      {/* Brand + connection */}
      <div className="flex items-center gap-2.5 shrink-0">
        <LogoMark size={34} />
        <div className="flex flex-col" style={{ lineHeight: 1 }}>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: "0.16em",
              color: "var(--color-text-1)",
            }}
          >
            <span style={{ color: "var(--color-accent-cue)" }}>DAW</span> REMOTE
          </span>
          <span className="flex items-center gap-1.5" style={{ marginTop: 5 }}>
            <Led on={conn.on} color={conn.color} size={6} blink={status.kind === "connecting"} />
            <span className="label-cap" style={{ fontSize: 10, color: connected ? "var(--color-text-2)" : undefined }}>
              {conn.label}
              {connected && latency !== null && (
                <span className="value-mono hidden sm:inline" style={{ marginLeft: 6, fontSize: 9, letterSpacing: 0 }}>
                  {latency}ms
                </span>
              )}
            </span>
          </span>
        </div>
        {(status.kind === "error" || status.kind === "disconnected") && (
          <button
            onClick={() => abletonStore.getState().reconnect()}
            className="tactile label-cap"
            style={{ height: 28, padding: "0 10px", color: "var(--color-accent-link)", fontSize: 11 }}
          >
            Reintentar
          </button>
        )}
      </div>

      {/* VFD window */}
      <div
        className="vfd flex-1 min-w-0 flex items-center gap-3 sm:gap-5"
        style={{ height: 46, padding: "0 14px", maxWidth: 760, margin: "0 auto" }}
      >
        <span
          className="shrink-0"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 12,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--color-vfd-ink)",
            opacity: 0.7,
          }}
        >
          {view}
        </span>

        <VfdDivider />

        {/* transport state glyphs */}
        <span className="shrink-0 flex items-center gap-2" aria-label="Estado del transporte">
          <VfdGlyph on={clock.isPlaying} title="Reproduciendo">
            <svg width="11" height="12" viewBox="0 0 11 12" fill="currentColor"><path d="M1 0.5 L10.5 6 L1 11.5Z" /></svg>
          </VfdGlyph>
          <VfdGlyph on={recording} title="Grabando" color="var(--color-accent-rec)">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor"><circle cx="5.5" cy="5.5" r="5" /></svg>
          </VfdGlyph>
        </span>

        {/* position */}
        <span className="seg shrink-0" style={{ fontSize: 22, lineHeight: 1 }} aria-label="Posición">
          {countingIn ? "-.-.-" : clock.barsDisplay}
        </span>

        <span
          className="hidden sm:inline shrink-0"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 14,
            color: "var(--color-vfd-ink)",
            textShadow: "0 0 6px rgba(255,178,62,0.45)",
          }}
        >
          {clock.signatureDisplay}
        </span>

        <span className="hidden md:inline-flex"><VfdDivider /></span>

        <span
          className="hidden md:block truncate min-w-0"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 16,
            letterSpacing: "0.04em",
            color: "var(--color-vfd-ink)",
            textShadow: "0 0 6px rgba(255,178,62,0.45)",
          }}
          title={projectName}
        >
          {connected ? projectName || "Sin título" : "Esperando a Live"}
        </span>

        {clock.isPlaying && (
          <span className="beat-dot shrink-0 ml-auto hidden sm:block" aria-hidden>
            <Led on color="var(--color-vfd-ink)" size={6} />
          </span>
        )}
      </div>

      {/* CPU */}
      {cpu !== undefined && (
        <div className="hidden lg:flex items-center gap-2 shrink-0">
          <span className="label-cap" style={{ fontSize: 10 }}>CPU</span>
          <Meter level={cpu} vertical={false} thickness={8} length={64} segments={12} />
          <span className="value-mono" style={{ fontSize: 11, width: 30, textAlign: "right", color: "var(--color-text-2)" }}>
            {Math.round(cpu * 100)}%
          </span>
        </div>
      )}
    </header>
  );
}

function VfdDivider() {
  return <span aria-hidden className="shrink-0" style={{ width: 1, height: 22, background: "rgba(255,178,62,0.18)" }} />;
}

function VfdGlyph({
  on,
  color = "var(--color-vfd-ink)",
  title,
  children,
}: {
  on: boolean;
  color?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      style={{
        display: "flex",
        color: on ? color : "rgba(255,178,62,0.1)",
        filter: on ? `drop-shadow(0 0 4px ${color})` : undefined,
        transition: "color 80ms",
      }}
    >
      {children}
    </span>
  );
}
