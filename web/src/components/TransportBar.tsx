import { useState } from "react";
import { useAbleton, useLiveProp } from "../lib/hooks";
import {
  IconArrowLeft,
  IconArrowRight,
  IconClick,
  IconLoop,
  IconPlay,
  IconRecord,
  IconStop,
} from "./icons";
import { TempoDial } from "./TempoDial";
import { ConnectionGate } from "./ConnectionGate";
import { toast } from "../lib/toast";

async function safeRun(fn: () => Promise<unknown>, label: string) {
  try {
    await fn();
  } catch {
    toast(`No se pudo: ${label}`);
  }
}

export function TransportBar() {
  const client = useAbleton();
  const isPlaying = useLiveProp<any>(client, (c) => c.song, "is_playing");
  const recordArm = useLiveProp<any>(client, (c) => c.song, "session_record");
  const loop = useLiveProp<any>(client, (c) => c.song, "loop");
  const metronome = useLiveProp<any>(client, (c) => c.song, "metronome");
  const tempo = useLiveProp<any>(client, (c) => c.song, "tempo");

  const [pressedPlay, setPressedPlay] = useState(false);
  const [pressedStop, setPressedStop] = useState(false);
  const [pressedRec, setPressedRec] = useState(false);

  const playLabel = isPlaying ? "Pause" : "Play";
  const isRecording = recordArm === 1 || recordArm === 2;

  async function handlePlay() {
    if (!client) return;
    await safeRun(
      () =>
        isPlaying ? client.song.stopPlaying() : client.song.startPlaying(),
      isPlaying ? "pausar" : "reproducir",
    );
  }

  async function handleStop() {
    if (!client) return;
    await safeRun(() => client.song.stopPlaying(), "parar");
  }

  async function handleRec() {
    if (!client) return;
    await safeRun(async () => {
      // Trigger session record by toggling the session_record property
      const current = await client.song.get("session_record");
      await client.song.set("session_record", current === 0 ? 1 : 0);
    }, "grabar");
  }

  async function handleLoop() {
    if (!client) return;
    await safeRun(() => client.song.set("loop", !loop), "cambiar loop");
  }

  async function handleClick() {
    if (!client) return;
    await safeRun(
      () => client.song.set("metronome", metronome ? 0 : 1),
      "cambiar click",
    );
  }

  async function handlePrevCue() {
    if (!client) return;
    await safeRun(() => client.song.jumpToPrevCue(), "ir a la marca anterior");
  }

  async function handleNextCue() {
    if (!client) return;
    await safeRun(() => client.song.jumpToNextCue(), "ir a la marca siguiente");
  }

  return (
    <>
      <footer
        className="shrink-0 flex items-center gap-3 sm:gap-4 overflow-x-auto scroll-touch px-3 sm:px-5"
        style={{
          height: 96,
          paddingBottom: "env(safe-area-inset-bottom)",
          background: "var(--color-surface-1)",
          borderTop: "1px solid var(--color-border)",
          touchAction: "pan-x",
        }}
      >
        {/* Cue jump */}
        <TransportButton
          label="◀◀"
          onPress={handlePrevCue}
          tone="cue"
          size="md"
        />
        <TransportButton
          label="▶▶"
          onPress={handleNextCue}
          tone="cue"
          size="md"
        />

        <Divider />

        {/* Stop */}
        <Pressable
          pressed={pressedStop}
          onPress={() => handleStop()}
          onPressChange={setPressedStop}
        >
          <BigButton color="stop" icon={<IconStop size={22} />} label="Stop" />
        </Pressable>

        {/* Play (the big one) */}
        <Pressable
          pressed={pressedPlay}
          onPress={() => handlePlay()}
          onPressChange={setPressedPlay}
        >
          <BigPlayButton isPlaying={!!isPlaying} label={playLabel} />
        </Pressable>

        {/* Rec */}
        <Pressable
          pressed={pressedRec}
          onPress={() => handleRec()}
          onPressChange={setPressedRec}
        >
          <BigButton
            color="rec"
            active={isRecording}
            icon={<IconRecord size={22} />}
            label="Rec"
          />
        </Pressable>

        <Divider />

        {/* Loop */}
        <TransportToggle
          active={!!loop}
          onClick={handleLoop}
          icon={<IconLoop size={18} />}
          label="Loop"
        />

        {/* Click */}
        <TransportToggle
          active={!!metronome}
          onClick={handleClick}
          icon={<IconClick size={18} />}
          label="Click"
        />

        <div className="flex-1 shrink-0" style={{ minWidth: 8 }} />

        {/* Tempo dial */}
        {client && tempo !== undefined && (
          <div className="shrink-0">
            <TempoDial
              tempo={tempo}
              onChange={(t) => {
                void client.song
                  .set("tempo", t)
                  .catch(() => toast("No se pudo cambiar el tempo"));
              }}
            />
          </div>
        )}
      </footer>
    </>
  );
}

function Divider() {
  return (
    <span
      className="w-px h-12 shrink-0"
      style={{ background: "var(--color-border)" }}
    />
  );
}

interface PressableProps {
  pressed: boolean;
  onPress: () => void;
  onPressChange: (p: boolean) => void;
  children: React.ReactNode;
}

function Pressable({ pressed, onPress, onPressChange, children }: PressableProps) {
  return (
    <button
      onPointerDown={() => onPressChange(true)}
      onPointerUp={() => onPressChange(false)}
      onPointerLeave={() => onPressChange(false)}
      onPointerCancel={() => onPressChange(false)}
      onClick={onPress}
      className={`shrink-0 ${pressed ? "tactile-active" : ""}`}
      style={{ touchAction: "manipulation" }}
    >
      {children}
    </button>
  );
}

function BigPlayButton({ isPlaying, label }: { isPlaying: boolean; label: string }) {
  const color = isPlaying ? "var(--color-accent-play)" : "var(--color-text-1)";
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="rounded-full flex items-center justify-center"
        style={{
          width: 64,
          height: 64,
          background: isPlaying
            ? "color-mix(in srgb, var(--color-accent-play) 18%, var(--color-surface-2))"
            : "var(--color-surface-3)",
          border: `2px solid ${isPlaying ? "var(--color-accent-play)" : "var(--color-border-strong)"}`,
          boxShadow: isPlaying
            ? `0 0 24px color-mix(in srgb, var(--color-accent-play) 35%, transparent),
               inset 0 0 12px color-mix(in srgb, var(--color-accent-play) 25%, transparent)`
            : "var(--shadow-inset-soft)",
          transition:
            "background 120ms var(--ease-instrument), border-color 120ms var(--ease-instrument), box-shadow 240ms var(--ease-instrument)",
        }}
      >
        {isPlaying ? (
          <span
            className="flex items-center justify-center"
            style={{ color }}
          >
            <IconStop size={26} />
          </span>
        ) : (
          <span
            className="flex items-center justify-center"
            style={{ color, marginLeft: 4 }}
          >
            <IconPlay size={26} />
          </span>
        )}
      </div>
      <span
        className="label-cap"
        style={{
          color: isPlaying ? "var(--color-accent-play)" : "var(--color-text-2)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function BigButton({
  color,
  active,
  icon,
  label,
}: {
  color: "stop" | "rec";
  active?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  const colorVar =
    color === "stop"
      ? "var(--color-accent-stop)"
      : "var(--color-accent-rec)";
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="rounded-full flex items-center justify-center"
        style={{
          width: 56,
          height: 56,
          background: active
            ? `color-mix(in srgb, ${colorVar} 18%, var(--color-surface-2))`
            : "var(--color-surface-3)",
          border: `1.5px solid ${active ? colorVar : "var(--color-border-strong)"}`,
          color: active ? colorVar : "var(--color-text-2)",
          boxShadow: active
            ? `0 0 18px color-mix(in srgb, ${colorVar} 30%, transparent)`
            : "var(--shadow-inset-soft)",
          transition: "all 120ms var(--ease-instrument)",
        }}
      >
        {icon}
      </div>
      <span className="label-cap" style={{ color: "var(--color-text-2)" }}>
        {label}
      </span>
    </div>
  );
}

function TransportButton({
  label,
  onPress,
  tone,
  size,
}: {
  label: string;
  onPress: () => void;
  tone: "cue" | "default";
  size: "sm" | "md";
}) {
  const colorVar =
    tone === "cue" ? "var(--color-accent-cue)" : "var(--color-text-1)";
  return (
    <button
      onClick={onPress}
      className="rounded-md tactile flex items-center justify-center shrink-0"
      style={{
        width: size === "md" ? 48 : 40,
        height: size === "md" ? 40 : 36,
        color: colorVar,
        fontFamily: "var(--font-mono)",
        fontWeight: 600,
      }}
    >
      {label}
    </button>
  );
}

function TransportToggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 tactile shrink-0"
      style={{
        padding: "6px 10px",
      }}
    >
      <span
        className="flex items-center justify-center"
        style={{
          width: 28,
          height: 28,
          color: active ? "var(--color-accent-cue)" : "var(--color-text-2)",
        }}
      >
        {icon}
      </span>
      <span
        className="label-cap"
        style={{
          color: active ? "var(--color-accent-cue)" : "var(--color-text-3)",
        }}
      >
        {label}
      </span>
    </button>
  );
}
