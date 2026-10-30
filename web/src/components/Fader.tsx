import { useRef, useState } from "react";

interface Props {
  value: number;
  onChange: (v: number) => void;
  vertical?: boolean;
  width?: number | string;
  height?: number | string;
  min?: number;
  max?: number;
}

/**
 * A touch-drag fader. Sizes accept pixels or CSS (e.g. "100%") —
 * drag math always measures the live element rect, so it works
 * inside flexible layouts too.
 *
 * Live ranges: volume 0.0..~1.0 (0.85 ≈ unity), panning -1.0..1.0,
 * sends/params use their own min/max.
 */
export function Fader({
  value,
  onChange,
  vertical = true,
  width = 32,
  height = 120,
  min = 0,
  max = 1,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const startPos = useRef(0);
  const startVal = useRef(0);

  const range = max - min;
  const fraction = range === 0 ? 0 : (value - min) / range;
  const clamped = Math.max(0, Math.min(1, fraction));

  function lengthOf(el: HTMLElement): number {
    const rect = el.getBoundingClientRect();
    const len = vertical ? rect.height : rect.width;
    return len > 0 ? len : 1;
  }

  function handleStart(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    startPos.current = vertical ? e.clientY : e.clientX;
    startVal.current = value;
  }

  function handleMove(e: React.PointerEvent) {
    if (!dragging) return;
    const el = e.currentTarget as HTMLElement;
    const current = vertical ? e.clientY : e.clientX;
    const delta = vertical
      ? startPos.current - current
      : current - startPos.current;
    const next = startVal.current + (delta / lengthOf(el)) * range;
    onChange(Math.max(min, Math.min(max, next)));
  }

  function handleEnd() {
    setDragging(false);
  }

  const bipolar = min < 0 && max > 0;

  return (
    <div
      onPointerDown={handleStart}
      onPointerMove={handleMove}
      onPointerUp={handleEnd}
      onPointerCancel={handleEnd}
      style={{
        width,
        height,
        minWidth: vertical ? undefined : 40,
        minHeight: vertical ? 40 : undefined,
        position: "relative",
        background: "var(--color-surface-3)",
        borderRadius: 6,
        boxShadow: "var(--shadow-inset-soft)",
        cursor: dragging ? "grabbing" : vertical ? "ns-resize" : "ew-resize",
        touchAction: "none",
        flexShrink: 0,
      }}
    >
      {/* Center line for bipolar ranges */}
      {bipolar &&
        (vertical ? (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: 2,
              right: 2,
              height: 1,
              background: "var(--color-border-strong)",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 2,
              bottom: 2,
              width: 1,
              background: "var(--color-border-strong)",
            }}
          />
        ))}
      {/* Fill from min end to current value */}
      {vertical ? (
        <div
          style={{
            position: "absolute",
            left: 2,
            right: 2,
            bottom: 2,
            height: `calc(${clamped * 100}% - ${clamped * 4}px)`,
            minHeight: clamped > 0 ? 3 : 0,
            background:
              "color-mix(in srgb, var(--color-accent-play) 30%, var(--color-surface-4))",
            borderRadius: 3,
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            top: 2,
            bottom: 2,
            left: 2,
            width: `calc(${clamped * 100}% - ${clamped * 4}px)`,
            minWidth: clamped > 0 ? 3 : 0,
            background:
              "color-mix(in srgb, var(--color-accent-play) 30%, var(--color-surface-4))",
            borderRadius: 3,
          }}
        />
      )}
      {/* Cap */}
      {vertical ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: `${clamped * 100}%`,
            width: "calc(100% - 4px)",
            height: 8,
            transform: "translate(-50%, 50%)",
            background: "var(--color-text-1)",
            borderRadius: 2,
            boxShadow: "var(--shadow-inset-pressed)",
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `${clamped * 100}%`,
            height: "calc(100% - 4px)",
            width: 8,
            transform: "translate(-50%, -50%)",
            background: "var(--color-text-1)",
            borderRadius: 2,
            boxShadow: "var(--shadow-inset-pressed)",
          }}
        />
      )}
    </div>
  );
}
