import { useEffect, useState } from "react";
import { abletonStore } from "../lib/ableton-store";
import { useAbleton, useConnectionStatus, useLiveProp, useLatency } from "../lib/hooks";
import { useSongClock } from "../lib/clock";
import { IconCpu, IconSignal } from "./icons";

interface Props {
  view: string;
}

export function TopBar({ view }: Props) {
  const status = useConnectionStatus();
  const client = useAbleton();
  const latency = useLatency();
  // song.name has no listener in Live — poll slowly instead.
  const projectName = useLiveProp<any>(client, (c) => c.song, "name", {
    listen: false,
    pollMs: 2000,
  });
  const tempo = useLiveProp<any>(client, (c) => c.song, "tempo");
  // Smooth interpolated transport clock (tempo + signature aware).
  const clock = useSongClock(client);
  const cpu = useLiveProp<any>(client, (c) => c.application, "average_process_usage", {
    listen: false,
    pollMs: 1000,
  });

  const isPlaying = useLiveProp<any>(
    client,
    (c) => c.song,
    "is_playing",
  );

  // Beat-synced pulse: when playing, set the CSS variable to the beat duration.
  useEffect(() => {
    if (!tempo) return;
    const beatSec = 60 / tempo;
    document.documentElement.style.setProperty(
      "--beat-duration",
      `${beatSec}s`,
    );
  }, [tempo]);

  const connectionLabel = (() => {
    switch (status.kind) {
      case "idle":
        return "Idle";
      case "connecting":
        return "Connecting…";
      case "connected":
        return "Connected";
      case "auth_required":
        return "Auth required";
      case "auth_failed":
        return "Auth failed";
      case "disconnected":
        return "Disconnected";
      case "error":
        return "Error";
    }
  })();

  const connectionColor = (() => {
    switch (status.kind) {
      case "connected":
        return "var(--color-accent-link)";
      case "connecting":
        return "var(--color-accent-cue)";
      case "auth_required":
      case "auth_failed":
      case "error":
        return "var(--color-critical)";
      default:
        return "var(--color-text-3)";
    }
  })();

  return (
    <header
      className="h-14 shrink-0 flex items-center px-3 sm:px-5 gap-3 sm:gap-5"
      style={{
        background: "var(--color-surface-1)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      {/* Connection badge */}
      <div className="flex items-center gap-2.5">
        <span
          className="w-2 h-2 rounded-full"
          style={{
            background: connectionColor,
            boxShadow:
              status.kind === "connected"
                ? `0 0 0 4px color-mix(in srgb, ${connectionColor} 22%, transparent)`
                : undefined,
            transition: "background 200ms var(--ease-instrument)",
          }}
        />
        <span
          className="label-cap"
          style={{ color: "var(--color-text-1)" }}
        >
          {connectionLabel}
        </span>
        {latency !== null && status.kind === "connected" && (
          <span
            className="value-mono text-text-3 hidden sm:inline"
            style={{ fontSize: 11 }}
          >
            {latency}ms
          </span>
        )}
        {status.kind === "error" && (
          <button
            onClick={() => abletonStore.getState().reconnect()}
            className="label-cap"
            style={{ color: "var(--color-accent-link)" }}
          >
            Retry
          </button>
        )}
      </div>

      <Divider />

      {/* View title */}
      <div className="flex items-center gap-2">
        <span
          className="label-cap"
          style={{ color: "var(--color-text-3)" }}
        >
          View
        </span>
        <span
          className="text-md font-semibold"
          style={{ letterSpacing: "-0.01em" }}
        >
          {view}
        </span>
      </div>

      <Divider />

      {/* Project name + beat-synced pulse (hidden on phones) */}
      <div className="hidden md:flex items-center gap-2.5 min-w-0">
        {isPlaying && tempo ? (
          <span
            className="beat-dot w-2 h-2 rounded-full"
            style={{ background: "var(--color-accent-play)" }}
          />
        ) : (
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: "var(--color-text-3)" }}
          />
        )}
        <span
          className="text-md font-semibold truncate"
          style={{ letterSpacing: "-0.01em" }}
        >
          {projectName ?? "—"}
        </span>
      </div>

      <div className="flex-1" />

      {/* CPU meter (hidden on phones/tablets) */}
      {cpu !== undefined && (
        <div className="hidden lg:flex items-center gap-2">
          <IconCpu size={14} className="text-text-3" />
          <div
            className="w-16 h-1.5 rounded-full overflow-hidden"
            style={{ background: "var(--color-surface-3)" }}
          >
            <div
              className="h-full"
              style={{
                width: `${Math.round(cpu * 100)}%`,
                background:
                  cpu > 0.85
                    ? "var(--color-accent-rec)"
                    : cpu > 0.6
                      ? "var(--color-accent-cue)"
                      : "var(--color-accent-play)",
                transition: "width 200ms var(--ease-instrument)",
              }}
            />
          </div>
          <span
            className="value-mono text-text-3"
            style={{ fontSize: 11, width: 32, textAlign: "right" }}
          >
            {Math.round(cpu * 100)}%
          </span>
        </div>
      )}

      <Divider />

      {/* Bars.beats.sixteenths — interpolated, signature-aware */}
      <div className="flex items-center gap-3">
        <IconSignal size={14} className="text-text-3" />
        <span
          className="value-mono"
          style={{
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: "0.02em",
            color: "var(--color-text-1)",
          }}
        >
          {clock.barsDisplay}
        </span>
      </div>
    </header>
  );
}

function Divider() {
  return (
    <span
      className="w-px h-6"
      style={{ background: "var(--color-border)" }}
    />
  );
}


