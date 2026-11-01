import { useEffect, useRef, useState } from "react";
import { useAbleton, useOptimistic } from "../lib/hooks";
import {
  useLiveChildProp,
  useLiveRawList,
  useMixerDevice,
  useMixerParam,
  useSends,
} from "../lib/list-hooks";
import { Fader } from "../components/Fader";
import { Knob } from "../components/Knob";
import { EmptyPanel, LedKey, Meter, ViewStrip } from "../components/hw";
import { colorToHex } from "../lib/color";
import { toast } from "../lib/toast";
import { IconCheck, IconPlus, IconX } from "../components/icons";

async function safeSet(target: any, prop: string, value: unknown, label: string) {
  try {
    await target.set(prop, value);
  } catch {
    toast(`No se pudo cambiar ${label}`);
  }
}

export function MixerView() {
  const client = useAbleton();
  const rawTracks = useLiveRawList<any>("song", "tracks");
  const rawReturns = useLiveRawList<any>("song", "return_tracks");
  const [trackMap, setTrackMap] = useState<Map<string, any>>(new Map());
  const [returnMap, setReturnMap] = useState<Map<string, any>>(new Map());
  const [master, setMaster] = useState<any>(null);

  useEffect(() => {
    if (!client || !rawTracks) {
      setTrackMap(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const tracks = await client.song.get("tracks");
        if (cancelled) return;
        const m = new Map<string, any>();
        for (const t of tracks) m.set(t.raw.id, t);
        setTrackMap(m);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, rawTracks]);

  useEffect(() => {
    if (!client || !rawReturns) {
      setReturnMap(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const tracks = await client.song.get("return_tracks");
        if (cancelled) return;
        const m = new Map<string, any>();
        for (const t of tracks) m.set(t.raw.id, t);
        setReturnMap(m);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, rawReturns]);

  useEffect(() => {
    if (!client) {
      setMaster(null);
      return;
    }
    let cancelled = false;
    client.song
      .get("master_track")
      .then((t: any) => {
        if (!cancelled) setMaster(t);
      })
      .catch(() => {
        if (!cancelled) setMaster(null);
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  async function addTrack(kind: "audio" | "midi" | "return") {
    if (!client) return;
    try {
      if (kind === "audio") await client.song.createAudioTrack(-1);
      else if (kind === "midi") await client.song.createMidiTrack(-1);
      else await client.song.createReturnTrack();
      toast(
        kind === "return" ? "Return creado" : `Track ${kind === "audio" ? "de audio" : "MIDI"} creado`,
      );
    } catch {
      toast("No se pudo crear el track");
    }
  }

  if (!client) return <EmptyPanel title="Live no está conectado" hint="Abre Ableton Live con DAWRemote activo como Control Surface." />;

  return (
    <div className="h-full flex flex-col">
      <ViewStrip className="flex-wrap py-2">
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, letterSpacing: "0.06em" }}>Mixer</span>
        <span className="value-mono" style={{ fontSize: 12, color: "var(--color-text-3)" }}>
          {(rawTracks?.length ?? 0)} tracks · {(rawReturns?.length ?? 0)} returns
        </span>
        <div className="flex-1" />
        <LedKey size="sm" color="play" label="+ Audio" onClick={() => void addTrack("audio")} />
        <LedKey size="sm" color="play" label="+ MIDI" onClick={() => void addTrack("midi")} />
        <LedKey size="sm" color="macro" label="+ Return" onClick={() => void addTrack("return")} />
      </ViewStrip>
      <div
        className="flex-1 min-h-0 overflow-auto scroll-touch"
        style={{ touchAction: "pan-x pan-y" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            minHeight: "100%",
            width: "max-content",
            minWidth: "100%",
            padding: 12,
            gap: 6,
          }}
        >
          {master && <MixerStrip key="master" client={client} track={master} isMaster />}
          {(rawTracks ?? []).map((raw, i) => {
            const track = trackMap.get(raw.id);
            if (!track) return null;
            return (
              <MixerStrip
                key={raw.id}
                client={client}
                track={track}
                onDelete={() => {
                  void client.song
                    .deleteTrack(i)
                    .then(() => toast("Track borrado"))
                    .catch(() => toast("No se pudo borrar"));
                }}
              />
            );
          })}
          {(rawReturns ?? []).map((raw, i) => {
            const track = returnMap.get(raw.id);
            if (!track) return null;
            return (
              <MixerStrip
                key={raw.id}
                client={client}
                track={track}
                isReturn
                onDelete={() => {
                  void client.song
                    .deleteReturnTrack(i)
                    .then(() => toast("Return borrado"))
                    .catch(() => toast("No se pudo borrar"));
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MixerStrip({
  client,
  track,
  isMaster,
  isReturn,
  onDelete,
}: {
  client: any;
  track: any;
  isMaster?: boolean;
  isReturn?: boolean;
  onDelete?: () => void;
}) {
  const name = useLiveChildProp<string>(track, "name");
  const color = useLiveChildProp<number>(track, "color");
  // Master has no mute/solo/arm and returns have no arm: don't even ask
  // Live (each refused request is an error in Live's log and a wasted trip).
  const channel = isMaster ? null : track;
  const armable = isMaster || isReturn ? null : track;
  const mute = useLiveChildProp<boolean>(channel, "mute");
  const solo = useLiveChildProp<boolean>(channel, "solo");
  const arm = useLiveChildProp<boolean>(armable, "arm");
  const canArm = useLiveChildProp<boolean>(armable, "can_be_armed");
  const meterL = useLiveChildProp<number>(track, "output_meter_left");
  const meterR = useLiveChildProp<number>(track, "output_meter_right");
  const [sendsOpen, setSendsOpen] = useState(false);
  const [ioOpen, setIoOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [armingDelete, setArmingDelete] = useState(false);
  const deleteTimer = useRef<number | null>(null);

  const mixer = useMixerDevice(track);
  const [liveVolume, setLiveVolume, volumeDisplay] = useMixerParam(mixer, "volume");
  const [livePanning, setLivePanning] = useMixerParam(mixer, "panning");
  const [volume, setVolume] = useOptimistic<number>(liveVolume, setLiveVolume);
  const [panning, setPanning] = useOptimistic<number>(livePanning, setLivePanning);
  const sends = useSends(isMaster ? null : mixer);

  useEffect(
    () => () => {
      if (deleteTimer.current !== null) window.clearTimeout(deleteTimer.current);
    },
    [],
  );

  const colorHex = isMaster
    ? "var(--color-accent-play)"
    : isReturn
      ? "var(--color-accent-macro)"
      : (colorToHex(color) ?? "var(--color-border-strong)");

  function startRename() {
    setDraft(name ?? "");
    setRenaming(true);
  }

  async function saveRename() {
    setRenaming(false);
    const next = draft.trim();
    if (!next || next === name) return;
    try {
      await track.set("name", next);
    } catch {
      toast("No se pudo renombrar");
    }
  }

  function handleDeleteTap() {
    if (!onDelete) return;
    if (!armingDelete) {
      setArmingDelete(true);
      if (deleteTimer.current !== null) window.clearTimeout(deleteTimer.current);
      deleteTimer.current = window.setTimeout(() => setArmingDelete(false), 3000);
      return;
    }
    if (deleteTimer.current !== null) window.clearTimeout(deleteTimer.current);
    setArmingDelete(false);
    setRenaming(false);
    onDelete();
  }

  return (
    <div
      className="flex flex-col items-center"
      style={{
        position: "relative",
        flex: "1 1 0",
        minWidth: 84,
        maxWidth: 136,
        padding: "0 6px 10px",
        borderRadius: 10,
        background: isMaster
          ? "linear-gradient(180deg, #2a2c31 0%, #1d1f23 100%)"
          : "linear-gradient(180deg, #23252a 0%, #1a1c20 100%)",
        border: "1px solid rgba(0,0,0,0.7)",
        boxShadow: isMaster
          ? "inset 0 1px 0 rgba(255,255,255,0.07), inset 0 0 0 1px color-mix(in srgb, var(--color-accent-play) 25%, transparent), 0 6px 14px rgba(0,0,0,0.4)"
          : "inset 0 1px 0 rgba(255,255,255,0.05), 0 6px 14px rgba(0,0,0,0.4)",
        overflow: "hidden",
      }}
    >
      {/* colour cap */}
      <div
        aria-hidden
        style={{
          alignSelf: "stretch",
          height: 4,
          margin: "0 -6px 8px",
          background: colorHex,
          boxShadow: `0 0 10px ${colorHex}`,
        }}
      />

      {/* scribble strip */}
      {renaming ? (
        <span className="flex items-center gap-1 w-full">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void saveRename();
              if (e.key === "Escape") setRenaming(false);
            }}
            autoFocus
            aria-label="Nombre del track"
            className="well"
            style={{
              flex: 1,
              minWidth: 0,
              color: "var(--color-text-1)",
              fontSize: 12,
              border: "1px solid var(--color-accent-cue)",
              padding: "4px 6px",
              outline: "none",
            }}
          />
          <button onClick={() => void saveRename()} aria-label="Guardar nombre" style={{ color: "var(--color-accent-play)", display: "flex" }}>
            <IconCheck size={15} />
          </button>
          {onDelete && (
            <button
              onClick={handleDeleteTap}
              aria-label="Borrar track"
              style={{
                color: armingDelete ? "var(--color-text-inverse)" : "var(--color-critical)",
                display: "flex",
                background: armingDelete ? "var(--color-critical)" : undefined,
                borderRadius: 4,
                padding: 2,
              }}
            >
              <IconX size={14} />
            </button>
          )}
        </span>
      ) : (
        <button
          onClick={isMaster ? undefined : startRename}
          className="vfd truncate w-full text-center"
          title={isMaster ? "Main" : "Toca para renombrar"}
          style={{
            height: 26,
            padding: "0 6px",
            fontFamily: "var(--font-display)",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.03em",
            color: "var(--color-vfd-ink)",
            textShadow: "0 0 6px rgba(255,178,62,0.45)",
          }}
        >
          {isMaster ? "MAIN" : name ?? "—"}
        </button>
      )}
      {armingDelete && (
        <span className="label-cap" style={{ fontSize: 9, color: "var(--color-critical)", marginTop: 3 }}>
          Toca ✕ otra vez
        </span>
      )}
      <span className="label-cap" style={{ fontSize: 9, marginTop: 4 }}>
        {isMaster ? "Master" : isReturn ? "Return" : "Track"}
      </span>

      {/* pan */}
      <div className="flex flex-col items-center" style={{ marginTop: 8 }}>
        <Knob
          value={panning ?? 0}
          min={-1}
          max={1}
          size={40}
          bare
          bipolar
          defaultValue={0}
          color="var(--color-accent-cue)"
          onChange={(v) => setPanning(v)}
          ariaLabel="Panorama"
        />
        <span className="value-mono" style={{ fontSize: 10, color: "var(--color-text-3)", marginTop: 2 }}>
          {formatPan(panning ?? 0)}
        </span>
      </div>

      {/* M S R */}
      {!isMaster && (
        <div className="flex items-center gap-1" style={{ marginTop: 8 }}>
          <LedKey size="xs" label="M" color="stop" active={!!mute} onClick={() => void safeSet(track, "mute", !mute, "mute")} width={24} />
          <LedKey size="xs" label="S" color="solo" active={!!solo} onClick={() => void safeSet(track, "solo", !solo, "solo")} width={24} />
          {canArm !== false && !isReturn && (
            <LedKey size="xs" label="R" color="rec" active={!!arm} onClick={() => void safeSet(track, "arm", !arm, "arm")} width={24} />
          )}
        </div>
      )}

      {/* fader + meters */}
      <div className="flex items-stretch justify-center gap-2 w-full" style={{ flex: 1, minHeight: 150, marginTop: 10 }}>
        <Fader
          value={volume ?? 0.85}
          onChange={(v) => setVolume(v)}
          width={34}
          height="100%"
          vertical
          scale
          defaultValue={0.85}
          color={isMaster ? "var(--color-accent-play)" : "var(--color-accent-cue)"}
          ariaLabel={`Volumen ${isMaster ? "main" : name ?? ""}`}
        />
        <div className="flex gap-0.5">
          <Meter level={meterL ?? 0} thickness={6} segments={28} />
          <Meter level={meterR ?? 0} thickness={6} segments={28} />
        </div>
      </div>

      <div className="vfd value-mono" style={{ marginTop: 8, padding: "3px 8px", fontSize: 11, fontWeight: 700, color: "var(--color-vfd-ink)", textShadow: "0 0 5px rgba(255,178,62,0.45)" }}>
        {volume !== undefined && liveVolume !== undefined && Math.abs(volume - liveVolume) < 0.0005 && volumeDisplay
          ? volumeDisplay
          : volumeToDb(volume ?? 0.85)}
      </div>

      <div className="flex items-center gap-1" style={{ marginTop: 8 }}>
        {sends && sends.length > 0 && (
          <LedKey
            size="xs"
            variant="ring"
            color="cue"
            active={sendsOpen}
            label="Sends"
            onClick={() => {
              setSendsOpen((e) => !e);
              if (!sendsOpen) setIoOpen(false);
            }}
          />
        )}
        {!isMaster && (
          <LedKey
            size="xs"
            variant="ring"
            color="link"
            active={ioOpen}
            label="I/O"
            onClick={() => {
              setIoOpen((e) => !e);
              if (!ioOpen) setSendsOpen(false);
            }}
          />
        )}
      </div>

      {sendsOpen && sends && (
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {sends.map((s: any, i: number) => (
            <SendKnob key={(s as any).raw?.id ?? i} index={i} param={s} />
          ))}
        </div>
      )}

      {ioOpen && !isMaster && <IoPanel track={track} />}
    </div>
  );
}

const nameOf = (x: any): string =>
  x == null ? "" : typeof x === "string" ? x : String(x.display_name ?? "");

/**
 * Input/output routing. Uses Live 11+/12 routing API
 * (input_routing_type / input_routing_channel …), which the MIDI script
 * serialises as { display_name } objects and accepts by display name.
 */
function IoPanel({ track }: { track: any }) {
  const inType = useLiveChildProp<any>(track, "input_routing_type");
  const inCh = useLiveChildProp<any>(track, "input_routing_channel");
  const outType = useLiveChildProp<any>(track, "output_routing_type");
  const outCh = useLiveChildProp<any>(track, "output_routing_channel");
  const [opts, setOpts] = useState<{
    inTypes: string[];
    inChs: string[];
    outTypes: string[];
    outChs: string[];
  } | null>(null);

  const inTypeName = nameOf(inType);
  const outTypeName = nameOf(outType);

  // Available channels depend on the selected type: refetch when it changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const get = (p: string) => track.get(p).catch(() => []);
      const [inTypes, inChs, outTypes, outChs] = await Promise.all([
        get("available_input_routing_types"),
        get("available_input_routing_channels"),
        get("available_output_routing_types"),
        get("available_output_routing_channels"),
      ]);
      if (cancelled) return;
      const names = (arr: any): string[] => (Array.isArray(arr) ? arr : []).map(nameOf).filter(Boolean);
      setOpts({ inTypes: names(inTypes), inChs: names(inChs), outTypes: names(outTypes), outChs: names(outChs) });
    })();
    return () => {
      cancelled = true;
    };
  }, [track, inTypeName, outTypeName]);

  async function setRouting(prop: string, value: string, label: string) {
    try {
      await track.set(prop, value);
    } catch {
      toast(`No se pudo cambiar ${label}`);
    }
  }

  if (!opts) {
    return <div className="label-cap mt-2" style={{ fontSize: 9 }}>Leyendo I/O…</div>;
  }

  return (
    <div className="flex flex-col gap-1.5 mt-2 w-full">
      <IoRow label="In" value={inTypeName} options={opts.inTypes} onChange={(v) => void setRouting("input_routing_type", v, "la entrada")} />
      <IoRow label="Ch" value={nameOf(inCh)} options={opts.inChs} onChange={(v) => void setRouting("input_routing_channel", v, "el canal de entrada")} />
      <IoRow label="Out" value={outTypeName} options={opts.outTypes} onChange={(v) => void setRouting("output_routing_type", v, "la salida")} />
      <IoRow label="Ch" value={nameOf(outCh)} options={opts.outChs} onChange={(v) => void setRouting("output_routing_channel", v, "el canal de salida")} />
    </div>
  );
}

function IoRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const shown = options.includes(value) ? value : "";
  return (
    <label className="flex flex-col gap-0.5 w-full">
      <span className="label-cap" style={{ fontSize: 9 }}>{label}</span>
      <select
        value={shown}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        style={{
          width: "100%",
          minWidth: 0,
          color: "var(--color-text-1)",
          border: "1px solid rgba(0,0,0,0.6)",
          borderRadius: 4,
          padding: "4px 4px",
          fontSize: 11,
        }}
      >
        {shown === "" && <option value="">{value || "—"}</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function SendKnob({ index, param }: { index: number; param: any }) {
  const live = useLiveChildProp<number>(param, "value");
  const [amount, setAmount] = useOptimistic<number>(live, (v) => {
    void param.set("value", v).catch(() => toast("No se pudo cambiar el send"));
  });
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Knob value={amount ?? 0} onChange={setAmount} size={34} bare color="var(--color-accent-macro)" defaultValue={0} ariaLabel={`Send ${String.fromCharCode(65 + index)}`} />
      <span className="label-cap" style={{ fontSize: 9 }}>{String.fromCharCode(65 + index)}</span>
    </div>
  );
}

function formatPan(p: number): string {
  const v = Math.round(p * 50);
  if (v === 0) return "C";
  return v < 0 ? `${-v}L` : `${v}R`;
}

function volumeToDb(v: number): string {
  if (v <= 0.0001) return "−∞ dB";
  // Rough estimate while dragging; Live's own readout replaces it on release.
  const db = 20 * Math.log10(v / 0.85);
  const clamped = Math.max(-70, Math.min(6, db));
  return `${clamped >= 0 ? "+" : "−"}${Math.abs(clamped).toFixed(1)} dB`;
}
