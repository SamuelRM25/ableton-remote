import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Text that grows as big as its box allows, and shrinks (wrapping onto more
 * lines first) when it doesn't fit. Long names like a medley title stay
 * inside their panel instead of spilling over the rest of the screen.
 *
 * The box is the parent's size: give FitText a container with a definite
 * width and height (flex-1 + min-h-0 works).
 */
export function FitText({
  children,
  max,
  min = 14,
  lineHeight = 1,
  style,
  className,
}: {
  children: ReactNode;
  /** Largest font size in px. */
  max: number;
  min?: number;
  lineHeight?: number;
  style?: CSSProperties;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState(max);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text) return;

    const fit = () => {
      const w = box.clientWidth;
      const h = box.clientHeight;
      if (w <= 0 || h <= 0) return;
      // Binary search the largest size whose wrapped text fits the box.
      let lo = min;
      let hi = max;
      let best = min;
      for (let i = 0; i < 14 && lo <= hi; i++) {
        const mid = Math.floor((lo + hi) / 2);
        text.style.fontSize = `${mid}px`;
        const fits = text.scrollHeight <= h + 1 && text.scrollWidth <= w + 1;
        if (fits) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      text.style.fontSize = `${best}px`;
      setSize(best);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    // Web fonts arriving late change the metrics.
    void (document as any).fonts?.ready?.then(fit);
    return () => ro.disconnect();
  }, [children, max, min]);

  return (
    <div ref={boxRef} className={className} style={{ width: "100%", height: "100%", minHeight: 0, overflow: "hidden", ...style }}>
      <div
        ref={textRef}
        style={{
          fontSize: size,
          lineHeight,
          width: "100%",
          overflowWrap: "break-word",
          hyphens: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}
