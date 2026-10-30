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

  if (!client) return <Empty>Sin conexión</Empty>;

  return (
    <div className="h-full flex flex-col">
      <div
        className="shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 flex-wrap"
        style={{
          background: "var(--color-surface-1)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <span className="label-cap">Mixer</span>
        <span className="value-mono" style={{ fontSize: 12, color: "var(--color-text-3)" }}>
          {(rawTracks?.length ?? 0) + (rawReturns?.length ?? 0) + (master ? 1 : 0)}
        </span>
        <div className="flex-1" />
        <AddBtn label="+ Audio" onClick={() => void addTrack("audio")} />
        <AddBtn label="+ MIDI" onClick={() => void addTrack("midi")} />
        <AddBtn label="+ Return" onClick={() => void addTrack("return")} />
      </div>
      <div
        className="flex-1 min-h-0 overflow-auto scroll-touch"
        style={{ background: "var(--color-bg)", touchAction: "pan-x pan-y" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            minHeight: "100%",
            width: "max-content",
            minWidth: "100%",
            padding: 12,
            gap: 2,
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

function AddBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="tactile"
      style={{
        height: 32,
        padding: "0 12px",
        fontSize: 12,
        fontWeight: 600,
        color: "var(--color-accent-play)",
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
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
  const mute = useLiveChildProp<boolean>(track, "mute");
  const solo = useLiveChildProp<boolean>(track, "solo");
  const arm = useLiveChildProp<boolean>(track, "arm");
  const canArm = useLiveChildProp<boolean>(track, "can_be_armed");
  const meterL = useLiveChildProp<number>(track, "output_meter_left");
  const meterR = useLiveChildProp<number>(track, "output_meter_right");
  const [sendsOpen, setSendsOpen] = useState(false);
  const [ioOpen, setIoOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [armingDelete, setArmingDelete] = useState(false);
  const deleteTimer = useRef<number | null>(null);

  const mixer = useMixerDevice(track);
  const [liveVolume, setLiveVolume] = useMixerParam(mixer, "volume");
  const [livePanning, setLivePanning] = useMixerParam(mixer, "panning");
  const [volume, setVolume] = useOptimistic<number>(liveVolume, setLiveVolume);
  const [panning, setPanning] = useOptimistic<number>(livePanning, setLivePanning);
  const sends = useSends(mixer);

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
        flex: "1 1 0",
        minWidth: 78,
        maxWidth: 132,
        padding: "10px 4px",
        background: isMaster
          ? "color-mix(in srgb, var(--color-accent-play) 8%, var(--color-surface-1))"
          : "var(--color-surface-1)",
        borderLeft: `3px solid ${colorHex}`,
        borderRight: "1px solid var(--color-border)",
      }}
    >
      {renaming ? (
        <span className="flex items-center gap-1 w-full" style={{ padding: "0 2px" }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void saveRename();
              if (e.key === "Escape") setRenaming(false);
            }}
            autoFocus
            style={{
              flex: 1,
              minWidth: 0,
              background: "var(--color-surface-2)",
              color: "var(--color-text-1)",
              fontSize: 11,
              border: "1px solid var(--color-accent-cue)",
              borderRadius: 5,
              padding: "3px 6px",
              outline: "none",
            }}
          />
          <button
            onClick={() => void saveRename()}
            aria-label="Guardar nombre"
            style={{ color: "var(--color-accent-play)", display: "flex" }}
          >
            <IconCheck size={14} />
          </button>
          {onDelete && (
            <button
              onClick={handleDeleteTap}
              aria-label="Borrar track"
              style={{
                color: "var(--color-critical)",
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
          onDoubleClick={isMaster ? undefined : startRename}
          className="truncate w-full text-center"
          title={isMaster ? "Master" : "Toca para renombrar"}
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: isMaster ? "var(--color-accent-play)" : "var(--color-text-1)",
            padding: "0 6px",
          }}
        >
          {isMaster ? "MAIN" : isReturn ? `↵ ${name ?? "—"}` : (name ?? "—")}
        </button>
      )}
      {armingDelete && (
        <span className="label-cap" style={{ fontSize: 8.5, color: "var(--color-critical)", marginTop: 2 }}>
          ¿borrar? toca ✕
        </span>
      )}

      {!isMaster && (
        <div className="flex items-center gap-1 mt-2">
          <SmallBtn
            label="M"
            active={!!mute}
            onClick={() => void safeSet(track, "mute", !mute, "mute")}
            color="var(--color-accent-stop)"
          />
          <SmallBtn
            label="S"
            active={!!solo}
            onClick={() => void safeSet(track, "solo", !solo, "solo")}
            color="var(--color-accent-cue)"
          />
          {canArm !== false && (
            <SmallBtn
              label="R"
              active={!!arm}
              onClick={() => void safeSet(track, "arm", !arm, "arm")}
              color="var(--color-accent-rec)"
            />
          )}
        </div>
      )}

      <div className="mt-2 flex items-stretch gap-1.5" style={{ flex: 1, minHeight: 130 }}>
        <Fader
          value={volume ?? 0.85}
          onChange={(v) => setVolume(v)}
          width={30}
          height="100%"
          vertical
        />
        <div className="flex gap-0.5" style={{ width: 12 }}>
          <MeterBar level={meterL ?? 0} />
          <MeterBar level={meterR ?? 0} />
        </div>
      </div>

      <div className="value-mono mt-1.5" style={{ fontSize: 10, color: "var(--color-text-3)" }}>
        {volumeToDb(volume ?? 0.85)}
      </div>

      <div className="mt-1.5 flex items-center" style={{ height: 28 }}>
        <Knob value={panning ?? 0} onChange={(v) => setPanning(v)} />
      </div>
      <div className="label-cap" style={{ fontSize: 9, color: "var(--color-text-3)" }}>
        Pan
      </div>

      <div className="flex items-center gap-1 mt-2">
        {sends && sends.length > 0 && (
          <button
            onClick={() => {
              setSendsOpen((e) => !e);
              if (!sendsOpen) setIoOpen(false);
            }}
            className="tactile"
            style={{
              height: 22,
              padding: "0 8px",
              fontSize: 10,
              fontWeight: 600,
              color: sendsOpen ? "var(--color-accent-cue)" : "var(--color-text-2)",
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              borderRadius: 5,
            }}
          >
            Sends
          </button>
        )}
        {!isMaster && (
          <button
            onClick={() => {
              setIoOpen((e) => !e);
              if (!ioOpen) setSendsOpen(false);
            }}
            className="tactile"
            style={{
              height: 22,
              padding: "0 8px",
              fontSize: 10,
              fontWeight: 600,
              color: ioOpen ? "var(--color-accent-link)" : "var(--color-text-2)",
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              borderRadius: 5,
            }}
          >
            I/O
          </button>
        )}
      </div>

      {sendsOpen && sends && (
        <div className="mt-2 flex gap-1.5">
          {sends.map((s: any, i: number) => (
            <SendStrip key={(s as any).nsid ?? (s as any).raw?.id ?? i} index={i} param={s} />
          ))}
        </div>
      )}

      {ioOpen && !isMaster && <IoPanel track={track} />}
    </div>
  );
}

function IoPanel({ track }: { track: any }) {
  const [opts, setOpts] = useState<{
    inTypes: string[];
    inSubs: string[];
    outTypes: string[];
    outSubs: string[];
  } | null>(null);

  const inType = useLiveChildProp<string>(track, "current_input_routing");
  const inSub = useLiveChildProp<string>(track, "current_input_sub_routing");
  const outType = useLiveChildProp<string>(track, "current_output_routing");
  const outSub = useLiveChildProp<string>(track, "current_output_sub_routing");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [inTypes, inSubs, outTypes, outSubs] = await Promise.all([
          track.get("available_input_routing_types").catch(() => []),
          track.get("available_input_routing_channels").catch(() => []),
          track.get("available_output_routing_types").catch(() => []),
          track.get("available_output_routing_channels").catch(() => []),
        ]);
        if (cancelled) return;
        const names = (arr: any): string[] =>
          (Array.isArray(arr) ? arr : []).map((x) =>
            typeof x === "string" ? x : (x.display_name ?? String(x)),
          );
        setOpts({
          inTypes: names(inTypes),
          inSubs: names(inSubs),
          outTypes: names(outTypes),
          outSubs: names(outSubs),
        });
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [track]);

  async function setRouting(prop: string, value: string, label: string) {
    try {
      await track.set(prop, value);
    } catch {
      toast(`No se pudo cambiar ${label}`);
    }
  }

  if (!opts) {
    return (
      <div className="label-cap mt-2" style={{ fontSize: 9 }}>
        Cargando I/O…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 mt-2 w-full" style={{ padding: "0 2px" }}>
      <IoRow
        label="In"
        value={inType ?? ""}
        options={opts.inTypes}
        onChange={(v) => void setRouting("current_input_routing", v, "entrada")}
      />
      <IoRow
        label="Ch"
        value={inSub ?? ""}
        options={opts.inSubs}
        onChange={(v) => void setRouting("current_input_sub_routing", v, "canal de entrada")}
      />
      <IoRow
        label="Out"
        value={outType ?? ""}
        options={opts.outTypes}
        onChange={(v) => void setRouting("current_output_routing", v, "salida")}
      />
      <IoRow
        label="Ch"
        value={outSub ?? ""}
        options={opts.outSubs}
        onChange={(v) => void setRouting("current_output_sub_routing", v, "canal de salida")}
      />
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
    <label className="flex items-center gap-1 w-full">
      <span className="label-cap shrink-0" style={{ fontSize: 8.5, width: 20 }}>
        {label}
      </span>
      <select
        value={shown}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        style={{
          flex: 1,
          minWidth: 0,
          background: "var(--color-surface-2)",
          color: "var(--color-text-1)",
          border: "1px solid var(--color-border)",
          borderRadius: 5,
          padding: "3px 4px",
          fontSize: 10,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {shown === "" && <option value="">—</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function SendStrip({ index, param }: { index: number; param: any }) {
  const sendAmount = useLiveChildProp<number>(param, "value");
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="label-cap" style={{ fontSize: 9 }}>
        {String.fromCharCode(65 + index)}
      </span>
      <Fader
        value={sendAmount ?? 0}
        onChange={(v) => {
          void param.set("value", v).catch(() => toast("No se pudo cambiar el send"));
        }}
        width={16}
        height={64}
        vertical
      />
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
      className="rounded-sm overflow-hidden"
      style={{
        background: "var(--color-surface-3)",
        flex: 1,
        width: "100%",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: `${fraction * 100}%`,
          background: color,
          transition: "height 60ms linear",
        }}
      />
    </div>
  );
}

function SmallBtn({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className="tactile"
      style={{
        width: 20,
        height: 18,
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        fontWeight: 700,
        color: active ? "var(--color-text-inverse)" : "var(--color-text-2)",
        background: active ? color : undefined,
        borderRadius: 4,
      }}
    >
      {label}
    </button>
  );
}

function Knob({
  value,
  onChange,
  size = 28,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
}) {
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const startVal = useRef(0);

  const fraction = (value + 1) / 2;
  const angle = -135 + fraction * 270;

  function handleStart(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    startY.current = e.clientY;
    startVal.current = value;
  }
  function handleMove(e: React.PointerEvent) {
    if (!dragging) return;
    const dy = startY.current - e.clientY;
    const next = startVal.current + dy / 100;
    onChange(Math.max(-1, Math.min(1, next)));
  }
  function handleEnd() {
    setDragging(false);
  }

  return (
    <div
      onPointerDown={handleStart}
      onPointerMove={handleMove}
      onPointerUp={handleEnd}
      onPointerCancel={handleEnd}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--color-surface-3)",
        border: `1px solid ${dragging ? "var(--color-accent-cue)" : "var(--color-border-strong)"}`,
        position: "relative",
        cursor: dragging ? "grabbing" : "ns-resize",
        touchAction: "none",
        boxShadow: "var(--shadow-inset-soft)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 2,
          left: "50%",
          transformOrigin: `50% ${size / 2 - 2}px`,
          transform: `translateX(-50%) rotate(${angle}deg)`,
          width: 2,
          height: size / 2 - 2,
          background: "var(--color-accent-macro)",
          borderRadius: 1,
          transition: dragging
            ? "none"
            : "transform 100ms var(--ease-instrument)",
        }}
      />
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex items-center justify-center">
      <span className="label-cap" style={{ color: "var(--color-text-3)" }}>
        {children}
      </span>
    </div>
  );
}

function volumeToDb(v: number): string {
  if (v <= 0) return "−∞";
  const db = 20 * Math.log10(v / 0.85);
  return `${db >= 0 ? "+" : ""}${db.toFixed(1)}dB`;
}

