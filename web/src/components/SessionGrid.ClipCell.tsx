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
    if (hasClip) {
      void slot.fire().catch(() => toast("No se pudo lanzar el clip"));
    }
  }

  // Instant tap feedback (no network round-trip wait).
  const [pressed, setPressed] = useState(false);

  // Visual state precedence
  const isLit = !!clipIsRecording || isPlayingThis;
  const isRec = !!clipIsRecording;

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
      className="w-full h-full relative overflow-hidden"
      style={{
        background: colorHex
          ? `color-mix(in srgb, ${colorHex} ${hasClip ? 70 : 30}%, var(--color-surface-1))`
          : "var(--color-surface-1)",
        transition: "background 80ms var(--ease-instrument)",
      }}
    >
      {hasClip ? (
        <div className="absolute inset-0 flex flex-col items-start justify-end p-1.5">
          <span
            className="truncate w-full text-left"
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--color-text-1)",
              textShadow: "0 1px 2px rgba(0,0,0,0.5)",
            }}
          >
            {name || "—"}
          </span>
        </div>
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ color: "var(--color-text-3)" }}
        >
          <span style={{ fontSize: 18, opacity: 0.3 }}>+</span>
        </div>
      )}

      {/* Playing/Recording indicator bar at the top */}
      {(isLit || isRec) && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: isRec
              ? "var(--color-accent-rec)"
              : "var(--color-accent-play)",
            boxShadow: isRec
              ? "0 0 8px var(--color-accent-rec)"
              : "0 0 8px var(--color-accent-play)",
          }}
        />
      )}

      {/* Instant pressed flash */}
      {pressed && hasClip && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            border: "2px solid var(--color-accent-link)",
            boxShadow:
              "inset 0 0 12px color-mix(in srgb, var(--color-accent-link) 35%, transparent)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Edit-mode affordance */}
      {editMode && hasClip && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            border: "2px dashed var(--color-critical)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Glow overlay when playing */}
      {clipIsPlaying && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            border: "2px solid var(--color-accent-play)",
            borderRadius: 0,
            boxShadow:
              "inset 0 0 12px color-mix(in srgb, var(--color-accent-play) 30%, transparent)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Recording flash */}
      {isRec && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            border: "2px solid var(--color-accent-rec)",
            borderRadius: 0,
            boxShadow:
              "inset 0 0 16px color-mix(in srgb, var(--color-accent-rec) 40%, transparent)",
            pointerEvents: "none",
            animation: "beat-pulse 0.6s var(--ease-instrument) infinite",
          }}
        />
      )}

      {/* Triggered (fired, waiting to launch) */}
      {isTriggered && !clipIsPlaying && !isRec && (
        <div
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--color-accent-cue)",
            boxShadow: "0 0 6px var(--color-accent-cue)",
          }}
        />
      )}
    </button>
  );
}
