import { useEffect, useRef, useState } from "react";
import type { Ableton } from "ableton-js";
import { useLiveChildProp } from "../lib/list-hooks";
import { toast } from "../lib/toast";
import { colorToHex } from "../lib/color";

interface Props {
  client: Ableton;
  track: any;
  sceneIdx: number;
  editMode?: boolean;
}

export function ClipCell({ client, track, sceneIdx, editMode }: Props) {
  const [slot, setSlot] = useState<any>(null);

  // Subscribe to track's clip_slots list to know when it changes.
  useLiveChildProp<any[]>(track, "clip_slots");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const slots = await track.get("clip_slots");
        if (cancelled) return;
        setSlot(slots[sceneIdx] ?? null);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [track, sceneIdx, client]);

  // Subscribe to playing_slot_index on the track to know if this cell is playing
  const playingSlot = useLiveChildProp<number>(track, "playing_slot_index");
  const isPlayingThis = playingSlot === sceneIdx;

  const hasClip = useLiveChildProp<boolean>(slot, "has_clip");
  const isTriggered = useLiveChildProp<boolean>(slot, "is_triggered");

  // We need the clip instance to read name/color
  const [clip, setClip] = useState<any>(null);
  useEffect(() => {
    if (!slot || !hasClip) {
      setClip(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const c = await slot.get("clip");
        if (!cancelled) setClip(c);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slot, hasClip]);

  // Clip props fall back to polling when Live has no listener for them.
  // Playing state is additionally derived from track.playing_slot_index.
  const name = useLiveChildProp<string>(clip, "name", { pollMs: 2000 });
  const color = useLiveChildProp<number>(clip, "color", { pollMs: 2000 });
  const clipIsPlaying = useLiveChildProp<boolean>(clip, "is_playing", { pollMs: 500 });
  const clipIsRecording = useLiveChildProp<boolean>(clip, "is_recording", { pollMs: 500 });

  const colorHex = colorToHex(color);

  function handleTap() {
    if (!slot) return;
    if (editMode) {
      if (!hasClip) return;
      void (async () => {
        try {
          await slot.deleteClip();
          toast("Clip borrado");
        } catch {
          toast("No se pudo borrar el clip");
        }
      })();
      return;
    }
    // Same as clicking the slot in Live: a clip launches; an empty slot
    // starts recording if the track is armed, otherwise stops the track.
    void slot.fire().catch(() => toast(hasClip ? "No se pudo lanzar el clip" : "No se pudo usar el slot"));
  }

  const [pressed, setPressed] = useState(false);

  const isRec = !!clipIsRecording;
  const isPlaying = !isRec && (!!clipIsPlaying || isPlayingThis);
  const isQueued = !!isTriggered && !isPlaying && !isRec;
  const base = colorHex ?? "#5a5d66";

  return (
    <button
      onClick={handleTap}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onContextMenu={(e) => {
        e.preventDefault();
        if (editMode) return;
        if (slot && hasClip) void slot.stop().catch(() => toast("No se pudo parar el clip"));
      }}
      aria-label={hasClip ? `Clip ${name ?? ""}` : "Slot vacío"}
      className="w-full h-full relative block"
      style={{ padding: 3, background: "transparent" }}
    >
      {hasClip ? (
        <span
          className="absolute flex flex-col justify-between overflow-hidden"
          style={{
            inset: 3,
            borderRadius: 6,
            padding: "5px 7px",
            background: `linear-gradient(180deg, color-mix(in srgb, ${base} ${isPlaying || isRec ? 100 : 78}%, white 8%) 0%, color-mix(in srgb, ${base} ${isPlaying || isRec ? 92 : 62}%, #101114) 100%)`,
            boxShadow: pressed
              ? "inset 0 3px 8px rgba(0,0,0,0.55)"
              : isRec
                ? "inset 0 0 0 2px var(--color-accent-rec), 0 0 16px color-mix(in srgb, var(--color-accent-rec) 55%, transparent)"
                : isPlaying
                  ? `inset 0 1px 0 rgba(255,255,255,0.45), inset 0 0 0 2px rgba(255,255,255,0.75), 0 0 18px color-mix(in srgb, ${base} 70%, transparent)`
                  : "inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -2px 0 rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.5)",
            filter: isPlaying || isRec ? "saturate(1.15) brightness(1.08)" : "saturate(0.9)",
            transform: pressed ? "translateY(1px)" : undefined,
            transition: "box-shadow 120ms var(--ease-instrument), filter 120ms, transform 60ms",
          }}
        >
          <span className="flex items-center gap-1.5">
            <ClipGlyph state={isRec ? "rec" : isPlaying ? "play" : isQueued ? "queued" : "idle"} />
          </span>
          <span
            className="truncate w-full text-left"
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "rgba(8,8,10,0.86)",
              textShadow: "0 1px 0 rgba(255,255,255,0.2)",
              letterSpacing: "0.005em",
            }}
          >
            {name || "Sin nombre"}
          </span>
          {editMode && (
            <span
              aria-hidden
              className="absolute inset-0"
              style={{ borderRadius: 6, border: "2px dashed var(--color-critical)", background: "rgba(255,77,106,0.18)" }}
            />
          )}
        </span>
      ) : (
        <span
          className="absolute well flex items-center justify-center"
          style={{
            inset: 3,
            borderRadius: 6,
            background: pressed ? "#16171a" : "#0f1012",
            boxShadow: pressed ? "inset 0 3px 8px rgba(0,0,0,0.9)" : undefined,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 9,
              height: 9,
              borderRadius: 2,
              border: "1.5px solid rgba(233,229,218,0.12)",
            }}
          />
        </span>
      )}
    </button>
  );
}

/** Live-style state glyph in the top-left corner of a clip. */
function ClipGlyph({ state }: { state: "idle" | "play" | "queued" | "rec" }) {
  if (state === "rec") {
    return (
      <span
        className="rec-blink"
        style={{ width: 9, height: 9, borderRadius: "50%", background: "#fff", boxShadow: "0 0 6px #fff" }}
      />
    );
  }
  const color = state === "idle" ? "rgba(8,8,10,0.55)" : "#ffffff";
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden
      className={state === "queued" ? "beat-dot" : undefined}
      style={{ filter: state === "play" ? "drop-shadow(0 0 4px rgba(255,255,255,0.9))" : undefined }}
    >
      <path d="M1 0.5 L9.5 5 L1 9.5Z" fill={color} />
    </svg>
  );
}
