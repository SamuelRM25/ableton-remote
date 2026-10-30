import { useEffect, useState } from "react";

export interface Viewport {
  w: number;
  h: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isPortrait: boolean;
}

/**
 * Breakpoints: mobile <640, tablet 640–1100, desktop ≥1100.
 * Used for structural layout switches (rail position, grid density…).
 * Simple show/hide tweaks use Tailwind responsive classes instead.
 */
export function useViewport(): Viewport {
  const [vp, setVp] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 1280,
    h: typeof window !== "undefined" ? window.innerHeight : 800,
  }));

  useEffect(() => {
    const onChange = () =>
      setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, []);

  const isMobile = vp.w < 640;
  const isTablet = vp.w >= 640 && vp.w < 1100;
  return {
    ...vp,
    isMobile,
    isTablet,
    isDesktop: !isMobile && !isTablet,
    isPortrait: vp.h >= vp.w,
  };
}
