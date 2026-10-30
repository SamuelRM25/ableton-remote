import { useRef, useState } from "react";

interface Props {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  size?: number;
  color?: string;
}

/**
 * A rotary control. Vertical drag to change value, with two-finger / fast
 * drag for coarse adjustment. The ring fills clockwise from -135° to +135°.
 */
export function Knob({
  value,
  onChange,
  min = 0,
  max = 1,
  size = 56,
  color = "var(--color-accent-play)",
}: Props) {
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const startVal = useRef(0);
  const lastDy = useRef(0);
  const lastT = useRef(0);

  const range = max - min;
  const fraction = range === 0 ? 0 : (value - min) / range;
  const angle = -135 + fraction * 270;

  function handleStart(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    startY.current = e.clientY;
    startVal.current = value;
    lastDy.current = 0;
    lastT.current = performance.now();
  }
  function handleMove(e: React.PointerEvent) {
    if (!dragging) return;
    const dy = startY.current - e.clientY;
    const now = performance.now();
    const dt = now - lastT.current || 1;
    const velocity = Math.abs((dy - lastDy.current) / dt);
    const sensitivity = velocity > 1.2 ? 80 : 120;
    const next = startVal.current + (dy / sensitivity) * range;
    onChange(Math.max(min, Math.min(max, next)));
    lastDy.current = dy;
    lastT.current = now;
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
        border: `1px solid ${dragging ? color : "var(--color-border-strong)"}`,
        position: "relative",
        cursor: dragging ? "grabbing" : "ns-resize",
        touchAction: "none",
        boxShadow: "var(--shadow-inset-soft)",
        transition: "border-color 120ms var(--ease-instrument)",
      }}
    >
      {/* Tick at 12 o'clock */}
      <span
        style={{
          position: "absolute",
          top: 3,
          left: "50%",
          transform: "translateX(-50%)",
          width: 2,
          height: 5,
          borderRadius: 1,
          background: "var(--color-border-strong)",
        }}
      />
      {/* Value indicator */}
      <div
        style={{
          position: "absolute",
          top: 6,
          left: "50%",
          transformOrigin: `50% ${size / 2 - 6}px`,
          transform: `translateX(-50%) rotate(${angle}deg)`,
          width: 3,
          height: size / 2 - 6,
          background: color,
          borderRadius: 2,
          transition: dragging
            ? "none"
            : "transform 120ms var(--ease-instrument)",
        }}
      />
      {/* Center label */}
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-3)",
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          fontWeight: 600,
        }}
      >
        {Math.round(fraction * 100)}
      </span>
    </div>
  );
}
