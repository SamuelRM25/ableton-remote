import type { Ableton } from "ableton-js";
import { useLiveChildProp, useMixerDevice, useMixerParam } from "../lib/list-hooks";
import { useOptimistic } from "../lib/hooks";
import { toast } from "../lib/toast";
import { colorToHex } from "../lib/color";
import { Fader } from "./Fader";
import { IconStop } from "./icons";

async function safeSet(track: any, prop: string, value: unknown, label: string) {
  try {
    await track.set(prop, value);
  } catch {
    toast(`No se pudo cambiar ${label} en este track`);
  }
}

interface Props {
  client: Ableton;
  track: any;
  index: number;
}

export function TrackHeader({ client, track, index }: Props) {
  const name = useLiveChildProp<string>(track, "name");
  const color = useLiveChildProp<number>(track, "color");
  const mute = useLiveChildProp<boolean>(track, "mute");
  const solo = useLiveChildProp<boolean>(track, "solo");
  const arm = useLiveChildProp<boolean>(track, "arm");
  // Group tracks can't be armed — Live greys the button out; we hide it.
  const canArm = useLiveChildProp<boolean>(track, "can_be_armed");
  const meterL = useLiveChildProp<number>(track, "output_meter_left");
  const meterR = useLiveChildProp<number>(track, "output_meter_right");
  const playingSlot = useLiveChildProp<number>(track, "playing_slot_index");

  const mixer = useMixerDevice(track);
  const [liveVolume, setLiveVolume] = useMixerParam(mixer, "volume");
  // Optimistic drag: the fader moves instantly, Live confirms via poll.
  const [volume, setVolume] = useOptimistic<number>(liveVolume, setLiveVolume);

  const colorHex = colorToHex(color) ?? "#3a3a45";

  async function handleStop() {
    try {
      const slots = await track.get("clip_slots");
      const idx = playingSlot ?? -1;
      if (idx >= 0 && slots[idx]) {
        await slots[idx].stop();
      }
    } catch {
      // ignore
    }
  }

  return (
    <div
      className="h-full flex flex-col"
      style={{ borderLeft: `3px solid ${colorHex}` }}
    >
      <div className="flex items-center gap-1.5 px-2.5 pt-1.5">
        <span
          className="value-mono"
          style={{
            fontSize: 10,
            color: "var(--color-text-3)",
            width: 18,
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <span
          className="truncate"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-text-1)",
            letterSpacing: "-0.005em",
          }}
        >
          {name ?? "—"}
        </span>
      </div>

      <div className="flex items-center gap-1 px-2 mt-1 flex-wrap" style={{ rowGap: 4 }}>
        <MuteButton
          active={!!mute}
          onClick={() => void safeSet(track, "mute", !mute, "mute")}
        />
        <SoloButton
          active={!!solo}
          onClick={() => void safeSet(track, "solo", !solo, "solo")}
        />
        {canArm !== false && (
          <ArmButton
            active={!!arm}
            onClick={() => void safeSet(track, "arm", !arm, "arm")}
          />
        )}
        <div className="flex-1" />
        <button
          onClick={() => void handleStop()}
          className="tactile shrink-0"
          style={{
            width: 22,
            height: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-text-3)",
            borderRadius: 6,
          }}
        >
          <IconStop size={12} />
        </button>
      </div>

      <div className="flex items-center gap-2 px-2.5 mt-1.5 flex-1 min-h-0">
        <Fader
          value={volume ?? 0.85}
          onChange={(v) => setVolume(v)}
          vertical
          height={36}
          width={16}
        />
        <div
          className="flex-1 flex items-end gap-0.5"
          style={{ height: 36 }}
        >
          <MeterBar level={meterL ?? 0} />
          <MeterBar level={meterR ?? 0} />
        </div>
      </div>
    </div>
  );
}

function MeterBar({ level }: { level: number }) {
  const fraction = Math.min(1, Math.max(0, level));
  const color =
    fraction > 0.85
      ? "var(--color-accent-rec)"
      : fraction > 0.6
        ? "var(--color-accent-cue)"
        : "var(--color-accent-play)";
  return (
    <div
      className="flex-1 rounded-sm overflow-hidden"
      style={{
        background: "var(--color-surface-3)",
        height: "100%",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: `${fraction * 100}%`,
          background: color,
          transition: "height 60ms linear",
        }}
      />
    </div>
  );
}

function MuteButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <TrackButton
      label="M"
      active={active}
      activeColor="var(--color-accent-stop)"
      onClick={onClick}
    />
  );
}

function SoloButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <TrackButton
      label="S"
      active={active}
      activeColor="var(--color-accent-cue)"
      onClick={onClick}
    />
  );
}

function ArmButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <TrackButton
      label="R"
      active={active}
      activeColor="var(--color-accent-rec)"
      onClick={onClick}
    />
  );
}

function TrackButton({
  label,
  active,
  activeColor,
  onClick,
}: {
  label: string;
  active: boolean;
  activeColor: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="tactile shrink-0"
      style={{
        width: 24,
        height: 20,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        fontWeight: 700,
        color: active ? "var(--color-text-inverse)" : "var(--color-text-2)",
        background: active ? activeColor : undefined,
        borderRadius: 5,
      }}
    >
      {label}
    </button>
  );
}
