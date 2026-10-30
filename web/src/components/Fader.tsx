import { useRef, useState } from "react";

interface Props {
  value: number;
  onChange: (v: number) => void;
  vertical?: boolean;
  width?: number | string;
  height?: number | string;
  min?: number;
  max?: number;
  /** LED colour of the fill line in the slot. */
  color?: string;
  /** Double-tap resets to this value (e.g. 0.85 = 0 dB for volume). */
  defaultValue?: number;
  /** Draw a tick scale beside the slot (big faders only). */
  scale?: boolean;
  ariaLabel?: string;
}

/**
 * Long-throw fader: recessed slot, LED fill line, machined cap with a
 * grip line. Drag is relative (grab anywhere, the cap never jumps).
 * Sizes accept pixels or CSS (e.g. "100%") — drag math measures the
 * live element rect, so it works inside flexible layouts.
 *
 * Live ranges: volume 0.0..1.0 (0.85 ≈ 0 dB), panning -1..1,
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
  color = "var(--color-accent-play)",
  defaultValue,
  scale,
  ariaLabel,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const startPos = useRef(0);
  const startVal = useRef(0);
  const lastTap = useRef(0);

  const range = max - min;
  const fraction = range === 0 ? 0 : (value - min) / range;
  const clamped = Math.max(0, Math.min(1, fraction));
  const bipolar = min < 0 && max > 0;
  const zero = bipolar ? (0 - min) / range : 0;

  function lengthOf(el: HTMLElement): number {
    const rect = el.getBoundingClientRect();
    const len = vertical ? rect.height : rect.width;
    return len > 0 ? len : 1;
  }

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
    startPos.current = vertical ? e.clientY : e.clientX;
    startVal.current = value;
  }

  function handleMove(e: React.PointerEvent) {
    if (!dragging) return;
    const el = e.currentTarget as HTMLElement;
    const current = vertical ? e.clientY : e.clientX;
    const delta = vertical ? startPos.current - current : current - startPos.current;
    const next = startVal.current + (delta / lengthOf(el)) * range;
    onChange(Math.max(min, Math.min(max, next)));
  }

  function handleEnd() {
    setDragging(false);
  }

  const capLong = vertical ? 22 : 14;
  const fillFrom = Math.min(zero, clamped);
  const fillTo = Math.max(zero, clamped);

  const cap = (
    <div
      style={{
        position: "absolute",
        ...(vertical
          ? {
              left: 0,
              right: 0,
              bottom: `calc(${clamped} * (100% - ${capLong}px))`,
              height: capLong,
            }
          : {
              top: 0,
              bottom: 0,
              left: `calc(${clamped} * (100% - ${capLong}px))`,
              width: capLong,
            }),
        borderRadius: 3,
        background: vertical
          ? "linear-gradient(180deg, #8d919a 0%, #4b4f57 18%, #2b2e34 50%, #4b4f57 82%, #1d1f23 100%)"
          : "linear-gradient(90deg, #8d919a 0%, #4b4f57 18%, #2b2e34 50%, #4b4f57 82%, #1d1f23 100%)",
        boxShadow: dragging
          ? `0 0 0 1px ${color}, 0 4px 10px rgba(0,0,0,0.7)`
          : "0 0 0 1px rgba(0,0,0,0.7), 0 4px 8px rgba(0,0,0,0.6)",
        pointerEvents: "none",
        transition: dragging ? "none" : "bottom 90ms linear, left 90ms linear",
      }}
    >
      {/* grip line */}
      <span
        style={{
          position: "absolute",
          ...(vertical
            ? { left: 3, right: 3, top: "50%", height: 2, marginTop: -1 }
            : { top: 3, bottom: 3, left: "50%", width: 2, marginLeft: -1 }),
          background: "#f2eee4",
          borderRadius: 1,
          boxShadow: "0 0 3px rgba(255,255,255,0.4)",
        }}
      />
    </div>
  );

  return (
    <div
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-orientation={vertical ? "vertical" : "horizontal"}
      onPointerDown={handleStart}
      onPointerMove={handleMove}
      onPointerUp={handleEnd}
      onPointerCancel={handleEnd}
      style={{
        width,
        height,
        minWidth: vertical ? 14 : 40,
        minHeight: vertical ? 40 : 14,
        position: "relative",
        cursor: dragging ? "grabbing" : vertical ? "ns-resize" : "ew-resize",
        touchAction: "none",
        flexShrink: 0,
      }}
    >
      {/* tick scale */}
      {scale && vertical && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: capLong / 2,
            bottom: capLong / 2,
            left: 0,
            right: 0,
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(233,229,218,0.22) 0 1px, transparent 1px 10%)",
            backgroundSize: "5px 100%",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "left top",
            pointerEvents: "none",
          }}
        />
      )}
      {/* slot */}
      <div
        className="well"
        style={{
          position: "absolute",
          ...(vertical
            ? { left: "50%", width: 6, marginLeft: -3, top: capLong / 2 - 3, bottom: capLong / 2 - 3 }
            : { top: "50%", height: 6, marginTop: -3, left: capLong / 2 - 3, right: capLong / 2 - 3 }),
          borderRadius: 3,
        }}
      >
        {/* LED fill */}
        <div
          style={{
            position: "absolute",
            ...(vertical
              ? {
                  left: 1,
                  right: 1,
                  bottom: `calc(${fillFrom * 100}% )`,
                  height: `calc(${(fillTo - fillFrom) * 100}%)`,
                }
              : {
                  top: 1,
                  bottom: 1,
                  left: `${fillFrom * 100}%`,
                  width: `${(fillTo - fillFrom) * 100}%`,
                }),
            background: color,
            borderRadius: 2,
            boxShadow: `0 0 6px ${color}`,
            opacity: 0.9,
          }}
        />
      </div>
      {/* bipolar centre detent */}
      {bipolar && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            background: "rgba(233,229,218,0.35)",
            ...(vertical
              ? { left: "15%", right: "15%", height: 1, bottom: `calc(${capLong / 2}px + ${zero} * (100% - ${capLong}px))` }
              : { top: "15%", bottom: "15%", width: 1, left: `calc(${capLong / 2}px + ${zero} * (100% - ${capLong}px))` }),
          }}
        />
      )}
      {cap}
    </div>
  );
}
