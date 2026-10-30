/**
 * Hardware primitives shared by every view: LED keys, segmented meters,
 * machined plates. Everything here is presentational — no Live access.
 */
import { memo, useState, type CSSProperties, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* LED colour helpers                                                  */
/* ------------------------------------------------------------------ */

export type LedColor =
  | "play"
  | "rec"
  | "stop"
  | "cue"
  | "solo"
  | "macro"
  | "link"
  | "critical"
  | "white";

export function ledVar(c: LedColor | string): string {
  switch (c) {
    case "play":
      return "var(--color-accent-play)";
    case "rec":
      return "var(--color-accent-rec)";
    case "stop":
      return "var(--color-accent-stop)";
    case "cue":
      return "var(--color-accent-cue)";
    case "solo":
      return "var(--color-accent-solo)";
    case "macro":
      return "var(--color-accent-macro)";
    case "link":
      return "var(--color-accent-link)";
    case "critical":
      return "var(--color-critical)";
    case "white":
      return "var(--color-text-1)";
    default:
      return c;
  }
}

export function glow(color: string, strength = 1): string {
  return `0 0 ${4 * strength}px ${color}, 0 0 ${14 * strength}px color-mix(in srgb, ${color} ${Math.round(45 * strength)}%, transparent)`;
}

/* ------------------------------------------------------------------ */
/* LED dot                                                             */
/* ------------------------------------------------------------------ */

export function Led({
  on,
  color = "play",
  size = 6,
  blink,
  style,
}: {
  on: boolean;
  color?: LedColor | string;
  size?: number;
  blink?: boolean;
  style?: CSSProperties;
}) {
  const c = ledVar(color);
  return (
    <span
      aria-hidden
      className={on && blink ? "rec-blink" : undefined}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: on
          ? `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${c} 40%, white) 0%, ${c} 45%, color-mix(in srgb, ${c} 70%, black) 100%)`
          : `radial-gradient(circle at 35% 30%, #3a3c42 0%, #1b1c20 70%)`,
        boxShadow: on
          ? glow(c, size / 8)
          : "inset 0 1px 1px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.05)",
        transition: "background 90ms, box-shadow 120ms",
        ...style,
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* LED key — the workhorse rubber button                               */
/* ------------------------------------------------------------------ */

interface LedKeyProps {
  label?: ReactNode;
  icon?: ReactNode;
  active?: boolean;
  color?: LedColor | string;
  onClick?: () => void;
  /** "fill": whole key lights up (M/S/R). "dot": LED above the legend. */
  variant?: "fill" | "dot" | "ring";
  size?: "xs" | "sm" | "md" | "lg";
  width?: number | string;
  height?: number | string;
  disabled?: boolean;
  blink?: boolean;
  title?: string;
  className?: string;
  style?: CSSProperties;
}

const KEY_SIZES = {
  xs: { h: 22, px: 6, fs: 11 },
  sm: { h: 30, px: 10, fs: 12 },
  md: { h: 44, px: 14, fs: 13 },
  lg: { h: 58, px: 16, fs: 14 },
} as const;

export function LedKey({
  label,
  icon,
  active = false,
  color = "cue",
  onClick,
  variant = "fill",
  size = "sm",
  width,
  height,
  disabled,
  blink,
  title,
  className,
  style,
}: LedKeyProps) {
  const [down, setDown] = useState(false);
  const c = ledVar(color);
  const s = KEY_SIZES[size];
  const lit = active && !disabled;

  const fillBg = lit
    ? `linear-gradient(180deg, color-mix(in srgb, ${c} 92%, white) 0%, ${c} 45%, color-mix(in srgb, ${c} 78%, black) 100%)`
    : "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(0,0,0,0.1)), var(--color-surface-3)";

  const background = variant === "fill" ? fillBg : lit
    ? `linear-gradient(180deg, color-mix(in srgb, ${c} 16%, #33363d), color-mix(in srgb, ${c} 8%, #25272c))`
    : "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(0,0,0,0.1)), var(--color-surface-3)";

  const textColor =
    variant === "fill"
      ? lit
        ? "rgba(10,10,12,0.85)"
        : "var(--color-text-2)"
      : lit
        ? c
        : "var(--color-text-2)";

  const pressed = down && !disabled;

  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      disabled={disabled}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      onPointerCancel={() => setDown(false)}
      onClick={onClick}
      className={className}
      style={{
        position: "relative",
        flexShrink: 0,
        display: "inline-flex",
        flexDirection: variant === "dot" ? "column" : "row",
        alignItems: "center",
        justifyContent: "center",
        gap: variant === "dot" ? 5 : 6,
        height: height ?? s.h,
        width,
        minWidth: s.h,
        padding: width !== undefined ? "0 4px" : `0 ${s.px}px`,
        borderRadius: size === "xs" ? 4 : size === "lg" ? 10 : 7,
        border: "1px solid rgba(0,0,0,0.6)",
        background,
        color: textColor,
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: s.fs,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        lineHeight: 1,
        opacity: disabled ? 0.4 : 1,
        transform: pressed ? "translateY(1px)" : undefined,
        boxShadow: pressed
          ? "var(--shadow-inset-pressed)"
          : lit && variant === "fill"
            ? `inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -2px 0 rgba(0,0,0,0.2), 0 0 14px color-mix(in srgb, ${c} 45%, transparent), 0 2px 4px rgba(0,0,0,0.5)`
            : lit && variant === "ring"
              ? `inset 0 0 0 1.5px ${c}, inset 0 0 12px color-mix(in srgb, ${c} 30%, transparent), 0 0 12px color-mix(in srgb, ${c} 30%, transparent), 0 2px 4px rgba(0,0,0,0.5)`
              : "var(--shadow-key)",
        transition:
          "background 90ms var(--ease-instrument), box-shadow 120ms var(--ease-instrument), transform 60ms",
        ...style,
      }}
    >
      {variant === "dot" && <Led on={lit} color={color} size={5} blink={blink} />}
      {icon && (
        <span
          className={lit && blink && variant !== "dot" ? "rec-blink" : undefined}
          style={{ display: "flex", filter: lit && variant !== "fill" ? `drop-shadow(0 0 4px ${c})` : undefined }}
        >
          {icon}
        </span>
      )}
      {label !== undefined && (
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{label}</span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented LED meter                                                 */
/* ------------------------------------------------------------------ */

/**
 * Vertical (or horizontal) LED ladder. `level` is Live's 0..1 meter value.
 * Rendered as a single gradient masked into segments: cheap enough for
 * dozens of meters updating at Live's push rate.
 */
export const Meter = memo(function Meter({
  level,
  vertical = true,
  thickness = 6,
  length = "100%",
  segments = 24,
}: {
  level: number;
  vertical?: boolean;
  thickness?: number;
  length?: number | string;
  segments?: number;
}) {
  const f = Math.max(0, Math.min(1, level || 0));
  const dir = vertical ? "to top" : "to right";
  const seg = `repeating-linear-gradient(${dir}, #000 0 calc(100% / ${segments} - 1px), transparent calc(100% / ${segments} - 1px) calc(100% / ${segments}))`;
  const ladder = `linear-gradient(${dir}, #2fe57d 0%, #2fe57d 62%, #ffcf3e 74%, #ffb23e 86%, #ff3b3b 94%)`;
  return (
    <div
      className="well"
      style={{
        position: "relative",
        width: vertical ? thickness : length,
        height: vertical ? length : thickness,
        flexShrink: 0,
        overflow: "hidden",
        padding: 1,
        borderRadius: 2,
      }}
    >
      {/* unlit segments */}
      <div
        style={{
          position: "absolute",
          inset: 1,
          background: ladder,
          opacity: 0.1,
          WebkitMaskImage: seg,
          maskImage: seg,
        }}
      />
      {/* lit segments */}
      <div
        style={{
          position: "absolute",
          inset: 1,
          background: ladder,
          WebkitMaskImage: seg,
          maskImage: seg,
          clipPath: vertical
            ? `inset(${(1 - f) * 100}% 0 0 0)`
            : `inset(0 ${(1 - f) * 100}% 0 0)`,
          filter: "drop-shadow(0 0 2px rgba(80,255,150,0.35))",
          transition: "clip-path 50ms linear",
        }}
      />
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Plate: a machined section with screws and a silkscreened title      */
/* ------------------------------------------------------------------ */

export function Screw({ style }: { style?: CSSProperties }) {
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background:
          "radial-gradient(circle at 35% 30%, #5b5f68 0%, #2a2c31 60%, #17181b 100%)",
        boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.06)",
        ...style,
      }}
    >
      <span
        style={{
          position: "absolute",
          left: 1,
          right: 1,
          top: 3,
          height: 1,
          background: "rgba(0,0,0,0.75)",
          transform: "rotate(35deg)",
        }}
      />
    </span>
  );
}

export function Plate({
  title,
  aside,
  children,
  className,
  style,
  padding = 18,
  screws = true,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  padding?: number;
  screws?: boolean;
}) {
  return (
    <section
      className={`panel ${className ?? ""}`}
      style={{ position: "relative", padding, ...style }}
    >
      {screws && (
        <>
          <Screw style={{ top: 7, left: 7 }} />
          <Screw style={{ top: 7, right: 7 }} />
          <Screw style={{ bottom: 7, left: 7 }} />
          <Screw style={{ bottom: 7, right: 7 }} />
        </>
      )}
      {(title || aside) && (
        <header
          className="flex items-center gap-3"
          style={{ marginBottom: 14, paddingLeft: screws ? 8 : 0, paddingRight: screws ? 8 : 0 }}
        >
          {title && (
            <h3 className="label-cap" style={{ margin: 0, color: "var(--color-text-2)", fontSize: 13 }}>
              {title}
            </h3>
          )}
          <span
            aria-hidden
            style={{
              flex: 1,
              height: 1,
              background: "linear-gradient(90deg, var(--color-border-strong), transparent)",
            }}
          />
          {aside}
        </header>
      )}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Toolbar strip that sits on top of a view                            */
/* ------------------------------------------------------------------ */

export function ViewStrip({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`shrink-0 flex items-center gap-3 px-3 sm:px-5 ${className ?? ""}`}
      style={{
        minHeight: 52,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.12)), var(--color-surface-1)",
        borderBottom: "1px solid rgba(0,0,0,0.6)",
        boxShadow: "0 1px 0 rgba(255,255,255,0.03)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Empty / offline state, written as a direction rather than a mood. */
export function EmptyPanel({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="vfd flex flex-col items-center text-center" style={{ padding: "22px 28px", maxWidth: 420 }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 18,
            letterSpacing: "0.04em",
            color: "var(--color-vfd-ink)",
            textShadow: "0 0 8px rgba(255,178,62,0.45)",
          }}
        >
          {title}
        </span>
        {hint && (
          <span style={{ marginTop: 6, fontSize: 13, color: "var(--color-text-2)", lineHeight: 1.45 }}>
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}
