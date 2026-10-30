import { useRef, useState } from "react";

interface Props {
  tempo: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
}

const SIZE = 64;
const STROKE = 3;

/**
 * A touch-drag knob for BPM. Drag vertically (or anywhere on the dial) to
 * change the value. Coarse / fine drag based on velocity.
 */
export function TempoDial({ tempo, onChange, min = 20, max = 999 }: Props) {
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const startTempo = useRef(0);
  const lastDy = useRef(0);
  const lastTime = useRef(0);

  const fraction = (tempo - min) / (max - min);
  const angle = -135 + fraction * 270;

  function handleStart(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    startY.current = e.clientY;
    startTempo.current = tempo;
    lastDy.current = 0;
    lastTime.current = performance.now();
  }

  function handleMove(e: React.PointerEvent) {
    if (!dragging) return;
    const dy = e.clientY - startY.current;
    const now = performance.now();
    const dt = now - lastTime.current || 1;
    const velocity = Math.abs((dy - lastDy.current) / dt);
    const sensitivity = velocity > 0.8 ? 0.3 : 0.6;
    const next = Math.min(
      max,
      Math.max(min, startTempo.current - dy * sensitivity),
    );
    onChange(Math.round(next * 10) / 10);
    lastDy.current = dy;
    lastTime.current = now;
  }

  function handleEnd() {
    setDragging(false);
  }

  return (
    <div
      className="flex items-center gap-3"
      onPointerDown={handleStart}
      onPointerMove={handleMove}
      onPointerUp={handleEnd}
      onPointerCancel={handleEnd}
      style={{ touchAction: "none" }}
    >
      <div
        className="relative rounded-full flex items-center justify-center"
        style={{
          width: SIZE,
          height: SIZE,
          background: "var(--color-surface-3)",
          border: `1px solid ${dragging ? "var(--color-accent-play)" : "var(--color-border-strong)"}`,
          boxShadow: "var(--shadow-inset-soft)",
          cursor: dragging ? "grabbing" : "ns-resize",
          transition: "border-color 120ms var(--ease-instrument)",
        }}
      >
        {/* Tick at 0deg (12 o'clock) */}
        <span
          className="absolute"
          style={{
            top: 4,
            left: "50%",
            transform: "translateX(-50%)",
            width: 2,
            height: 6,
            borderRadius: 1,
            background: "var(--color-border-strong)",
          }}
        />
        {/* Value indicator line */}
        <span
          className="absolute"
          style={{
            top: 8,
            left: "50%",
            transformOrigin: `50% ${SIZE / 2 - 8}px`,
            transform: `translateX(-50%) rotate(${angle}deg)`,
            width: 3,
            height: SIZE / 2 - 8,
            background: "var(--color-accent-play)",
            borderRadius: 2,
            transition: dragging
              ? "none"
              : "transform 120ms var(--ease-instrument)",
          }}
        />
        {/* Center label */}
        <span
          className="absolute flex items-center justify-center"
          style={{ inset: 0 }}
        >
          <span
            className="value-mono"
            style={{
              fontSize: 12,
              color: "var(--color-text-2)",
              fontWeight: 600,
              marginTop: 4,
            }}
          >
            BPM
          </span>
        </span>
      </div>

      <div className="flex flex-col">
        <span
          className="value-mono"
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "var(--color-text-1)",
            lineHeight: 1,
          }}
        >
          {tempo.toFixed(2)}
        </span>
        <span
          className="label-cap"
          style={{ marginTop: 2 }}
        >
          Tempo
        </span>
      </div>
    </div>
  );
}
