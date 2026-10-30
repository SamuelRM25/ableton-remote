import type { Ableton } from "ableton-js";
import { useLiveChildProp, useMixerDevice, useMixerParam } from "../lib/list-hooks";
import { useOptimistic } from "../lib/hooks";
import { toast } from "../lib/toast";
import { colorToHex } from "../lib/color";
import { Fader } from "./Fader";
import { IconStop } from "./icons";
import { LedKey, Meter } from "./hw";

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
      await track.stopAllClips();
    } catch {
      toast("No se pudo parar el track");
    }
  }

  return (
    <div className="h-full flex flex-col" style={{ padding: "0 6px 6px" }}>
      {/* colour cap */}
      <div
        aria-hidden
        style={{
          height: 4,
          margin: "0 -6px",
          background: colorHex,
          boxShadow: `0 0 10px color-mix(in srgb, ${colorHex} 60%, transparent)`,
        }}
      />
      <div className="flex items-center gap-1.5" style={{ marginTop: 6 }}>
        <span className="value-mono" style={{ fontSize: 10, color: "var(--color-text-3)" }}>
          {index + 1}
        </span>
        <span
          className="truncate"
          style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-1)", letterSpacing: "0.005em" }}
          title={name}
        >
          {name ?? "—"}
        </span>
      </div>

      <div className="flex items-center gap-1" style={{ marginTop: 6 }}>
        <LedKey size="xs" label="M" color="stop" active={!!mute} onClick={() => void safeSet(track, "mute", !mute, "mute")} title="Mute" />
        <LedKey size="xs" label="S" color="solo" active={!!solo} onClick={() => void safeSet(track, "solo", !solo, "solo")} title="Solo" />
        {canArm !== false && (
          <LedKey size="xs" label="R" color="rec" active={!!arm} onClick={() => void safeSet(track, "arm", !arm, "arm")} title="Armar" />
        )}
        <div className="flex-1" />
        <LedKey
          size="xs"
          color="stop"
          variant="ring"
          active={(playingSlot ?? -1) >= 0}
          title="Parar el clip de este track"
          icon={<IconStop size={10} />}
          onClick={() => void handleStop()}
          style={{ padding: 0 }}
        />
      </div>

      <div className="flex items-stretch gap-1.5 flex-1 min-h-0" style={{ marginTop: 6 }}>
        <Fader
          value={volume ?? 0.85}
          onChange={(v) => setVolume(v)}
          vertical={false}
          height={20}
          width="100%"
          defaultValue={0.85}
          ariaLabel={`Volumen ${name ?? ""}`}
        />
        <div className="flex gap-px" style={{ height: 20 }}>
          <Meter level={meterL ?? 0} thickness={4} segments={8} />
          <Meter level={meterR ?? 0} thickness={4} segments={8} />
        </div>
      </div>
    </div>
  );
}
