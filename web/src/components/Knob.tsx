import { useId, useRef, useState } from "react";

interface Props {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  size?: number;
  color?: string;
  /** Fill the ring from the centre (pan, bipolar params). */
  bipolar?: boolean;
  /** Double-tap resets to this value. */
  defaultValue?: number;
  /** Hide the centre readout (small knobs). */
  bare?: boolean;
  ariaLabel?: string;
}

const START = -135;
const SWEEP = 270;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  if (Math.abs(a1 - a0) < 0.01) return "";
  const from = polar(cx, cy, r, Math.min(a0, a1));
  const to = polar(cx, cy, r, Math.max(a0, a1));
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M ${from.x} ${from.y} A ${r} ${r} 0 ${large} 1 ${to.x} ${to.y}`;
}

/**
 * Machined rotary encoder with an LED ring. Vertical drag changes the
 * value (fast drags are coarser), double-tap resets to `defaultValue`.
 */
export function Knob({
  value,
  onChange,
  min = 0,
  max = 1,
  size = 56,
  color = "var(--color-accent-cue)",
  bipolar,
  defaultValue,
  bare,
  ariaLabel,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const startVal = useRef(0);
  const lastY = useRef(0);
  const lastT = useRef(0);
  const lastTap = useRef(0);
  const gid = useId().replace(/:/g, "");

  const range = max - min;
  const fraction = range === 0 ? 0 : Math.max(0, Math.min(1, (value - min) / range));
  const angle = START + fraction * SWEEP;
  const isBipolar = bipolar ?? (min < 0 && max > 0);
  const zeroAngle = isBipolar ? START + ((0 - min) / range) * SWEEP : START;

  const c = size / 2;
  const ringR = c - 3;
  const capR = c * 0.66;

  function handleStart(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const now = performance.now();
    if (defaultValue !== undefined && now - lastTap.current < 280) {
      onChange(defaultValue);
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;
    setDragging(true);
    startY.current = e.clientY;
    lastY.current = e.clientY;
    startVal.current = value;
    lastT.current = now;
  }
  function handleMove(e: React.PointerEvent) {
    if (!dragging) return;
    const now = performance.now();
    const dt = now - lastT.current || 1;
    const velocity = Math.abs((e.clientY - lastY.current) / dt);
    // Re-anchor on speed changes so fine/coarse switching never jumps.
    const travel = velocity > 1.2 ? 110 : 220;
    const dy = lastY.current - e.clientY;
    startVal.current = Math.max(min, Math.min(max, startVal.current + (dy / travel) * range));
    onChange(startVal.current);
    lastY.current = e.clientY;
    lastT.current = now;
  }
  function handleEnd() {
    setDragging(false);
  }

  const pointerStart = polar(c, c, capR * 0.35, angle);
  const pointerEnd = polar(c, c, capR * 0.9, angle);

  return (
    <div
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={handleStart}
      onPointerMove={handleMove}
      onPointerUp={handleEnd}
      onPointerCancel={handleEnd}
      style={{
        width: size,
        height: size,
        position: "relative",
        cursor: dragging ? "grabbing" : "ns-resize",
        touchAction: "none",
        flexShrink: 0,
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible" }}>
        <defs>
          <radialGradient id={`cap-${gid}`} cx="40%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#5a5e67" />
            <stop offset="55%" stopColor="#2c2f35" />
            <stop offset="100%" stopColor="#17181b" />
          </radialGradient>
          <linearGradient id={`rim-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6b6f78" />
            <stop offset="100%" stopColor="#101114" />
          </linearGradient>
        </defs>
        {/* ring track */}
        <path
          d={arc(c, c, ringR, START, START + SWEEP)}
          fill="none"
          stroke="#0b0c0e"
          strokeWidth={size > 40 ? 4 : 3}
          strokeLinecap="round"
        />
        {/* lit arc */}
        <path
          d={arc(c, c, ringR, zeroAngle, angle)}
          fill="none"
          stroke={color}
          strokeWidth={size > 40 ? 3 : 2.2}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 3px ${color})` }}
        />
        {/* cap shadow */}
        <circle cx={c} cy={c + 1.5} r={capR} fill="rgba(0,0,0,0.6)" />
        {/* cap rim + face */}
        <circle cx={c} cy={c} r={capR} fill={`url(#rim-${gid})`} />
        <circle cx={c} cy={c} r={capR - 1.5} fill={`url(#cap-${gid})`} />
        {/* knurling */}
        {size >= 44 &&
          Array.from({ length: 24 }).map((_, i) => {
            const a = (i * 360) / 24;
            const p0 = polar(c, c, capR - 1.5, a);
            const p1 = polar(c, c, capR - 4, a);
            return (
              <line
                key={i}
                x1={p0.x}
                y1={p0.y}
                x2={p1.x}
                y2={p1.y}
                stroke="rgba(0,0,0,0.45)"
                strokeWidth={1}
              />
            );
          })}
        {/* pointer */}
        <line
          x1={pointerStart.x}
          y1={pointerStart.y}
          x2={pointerEnd.x}
          y2={pointerEnd.y}
          stroke={dragging ? color : "#ece8de"}
          strokeWidth={size > 40 ? 2.5 : 2}
          strokeLinecap="round"
        />
      </svg>
      {!bare && size >= 56 && (
        <span
          className="value-mono"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: -2,
            textAlign: "center",
            fontSize: 9,
            fontWeight: 700,
            color: dragging ? color : "var(--color-text-3)",
            pointerEvents: "none",
          }}
        >
          {Math.round(fraction * 100)}
        </span>
      )}
    </div>
  );
}
