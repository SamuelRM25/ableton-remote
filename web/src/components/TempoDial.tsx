import { useRef, useState } from "react";

interface Props {
  tempo: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  /** "compact" for the transport strip, "large" for the Transport view. */
  size?: "compact" | "large";
}

/**
 * Tempo encoder: drag up/down anywhere on the display. Slow drags move in
 * 0.1 BPM steps, fast drags in whole BPM. Double-tap rounds to the
 * nearest integer.
 */
export function TempoDial({ tempo, onChange, min = 20, max = 999, size = "compact" }: Props) {
  const [dragging, setDragging] = useState(false);
  const lastY = useRef(0);
  const lastT = useRef(0);
  const acc = useRef(0);
  const lastTap = useRef(0);
  const large = size === "large";

  function handleStart(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const now = performance.now();
    if (now - lastTap.current < 280) {
      onChange(Math.round(tempo));
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;
    setDragging(true);
    lastY.current = e.clientY;
    lastT.current = now;
    acc.current = tempo;
  }

  function handleMove(e: React.PointerEvent) {
    if (!dragging) return;
    const now = performance.now();
    const dy = lastY.current - e.clientY;
    const dt = now - lastT.current || 1;
    const velocity = Math.abs(dy / dt);
    const perPx = velocity > 0.9 ? 0.5 : 0.1;
    acc.current = Math.min(max, Math.max(min, acc.current + dy * perPx));
    onChange(Math.round(acc.current * 10) / 10);
    lastY.current = e.clientY;
    lastT.current = now;
  }

  function handleEnd() {
    setDragging(false);
  }

  const [whole, frac] = tempo.toFixed(2).split(".");

  return (
    <div
      role="slider"
      aria-label="Tempo"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={tempo}
      onPointerDown={handleStart}
      onPointerMove={handleMove}
      onPointerUp={handleEnd}
      onPointerCancel={handleEnd}
      className="vfd flex items-end"
      style={{
        touchAction: "none",
        cursor: dragging ? "grabbing" : "ns-resize",
        padding: large ? "14px 18px 12px" : "8px 12px 7px",
        gap: large ? 10 : 7,
        boxShadow: dragging
          ? "inset 0 0 0 1px var(--color-accent-cue), inset 0 3px 10px rgba(0,0,0,0.8), 0 0 16px rgba(255,178,62,0.2)"
          : undefined,
        transition: "box-shadow 120ms var(--ease-instrument)",
      }}
    >
      <div className="relative" style={{ lineHeight: 1 }}>
        {/* unlit ghost segments behind the digits */}
        <span
          aria-hidden
          className="seg"
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            fontSize: large ? 52 : 26,
            color: "var(--color-vfd-ghost)",
            textShadow: "none",
            whiteSpace: "nowrap",
          }}
        >
          888.88
        </span>
        <span className="seg" style={{ position: "relative", fontSize: large ? 52 : 26, whiteSpace: "nowrap" }}>
          {whole.padStart(3, "!")}.{frac}
        </span>
      </div>
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: large ? 14 : 11,
          letterSpacing: "0.12em",
          color: "var(--color-vfd-ink)",
          opacity: 0.75,
          paddingBottom: large ? 4 : 2,
        }}
      >
        BPM
      </span>
    </div>
  );
}
