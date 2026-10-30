import { useEffect, useRef, useState } from "react";
import type { Ableton } from "ableton-js";
import { useLiveProp } from "./hooks";

export interface SongClock {
  /** Interpolated arrangement time in seconds. */
  timeSec: number;
  bar: number;
  beat: number;
  sixteenth: number;
  tempo: number;
  beatsPerBar: number;
  beatUnit: number;
  isPlaying: boolean;
  /** "11.1.2" style display string. */
  barsDisplay: string;
  /** "4/4" style signature string. */
  signatureDisplay: string;
}

/**
 * Smooth, tempo- and time-signature-aware transport clock.
 *
 * - tempo / signature numerator / is_playing come from Live listeners.
 * - current_song_time is polled (250 ms) and INTERPOLATED between polls
 *   with performance.now(), advancing only while playing. This keeps the
 *   bar.beat.sixteenth counter glued to Live instead of stepping at 4 Hz.
 * - Bars honor the live time signature (beatsPerBar = numerator),
 *   not a hardcoded 4/4.
 */
export function useSongClock(client: Ableton | null): SongClock {
  const tempo = useLiveProp<number>(client, (c) => c.song, "tempo") ?? 120;
  const sigNum =
    useLiveProp<number>(client, (c) => c.song, "signature_numerator") ?? 4;
  const sigDen =
    useLiveProp<number>(client, (c) => c.song, "signature_denominator") ?? 4;
  const isPlaying =
    useLiveProp<boolean>(client, (c) => c.song, "is_playing") ?? false;

  const baseRef = useRef({ t: 0, at: 0 });
  const liveRef = useRef({ tempo, sigNum, sigDen, isPlaying });
  liveRef.current = { tempo, sigNum, sigDen, isPlaying };

  const [, setTick] = useState(0);
  const lastDisplayRef = useRef("");

  // Poll the playhead and rebase the interpolation.
  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    const fetch = async () => {
      try {
        const t = await client.song.get("current_song_time");
        if (!cancelled && typeof t === "number") {
          baseRef.current = { t, at: performance.now() };
        }
      } catch {
        // ignore
      }
    };
    void fetch();
    const timer = window.setInterval(fetch, 250);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [client]);

  // Animation loop: recompute display, re-render only when it changes.
  // Capped at ~30 fps: smooth for musicians, cheap for the iPad.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const { tempo: tp, sigNum: sn, isPlaying: pl } = liveRef.current;
      const { t, at } = baseRef.current;
      const now = pl && at > 0 ? t + (performance.now() - at) / 1000 : t;
      const key = `${formatClock(now, tp, sn)}:${Math.floor(now * 30)}`;
      if (key !== lastDisplayRef.current) {
        lastDisplayRef.current = key;
        setTick((n) => n + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const { tempo: tp, sigNum: sn, sigDen: sd, isPlaying: pl } = liveRef.current;
  const { t, at } = baseRef.current;
  const now = pl && at > 0 ? t + (performance.now() - at) / 1000 : t;
  return buildClock(now, tp, sn, sd, pl);
}

function formatClock(
  timeSec: number,
  tempo: number,
  beatsPerBar: number,
  beatUnit = 4,
): string {
  return buildClock(timeSec, tempo, beatsPerBar, beatUnit, true).barsDisplay;
}

function buildClock(
  timeSec: number,
  tempo: number,
  beatsPerBarRaw: number,
  beatUnitRaw: number,
  isPlaying: boolean,
): SongClock {
  const safeTempo = tempo > 0 ? tempo : 120;
  const bpb = beatsPerBarRaw > 0 ? Math.floor(beatsPerBarRaw) : 4;
  const unit = beatUnitRaw > 0 ? Math.floor(beatUnitRaw) : 4;
  const totalBeats = (Math.max(0, timeSec) * safeTempo) / 60;
  const bar = Math.floor(totalBeats / bpb) + 1;
  const beat = Math.floor(mod(totalBeats, bpb)) + 1;
  const sixteenth = Math.floor(mod(totalBeats * 4, 4)) + 1;
  return {
    timeSec: Math.max(0, timeSec),
    bar,
    beat,
    sixteenth,
    tempo: safeTempo,
    beatsPerBar: bpb,
    beatUnit: unit,
    isPlaying,
    barsDisplay: `${bar}.${beat}.${sixteenth}`,
    signatureDisplay: `${bpb}/${unit}`,
  };
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** m:ss.cs wall-time formatting for an arrangement time in seconds. */
export function formatTimeMs(totalSeconds: number): string {
  const ms = Math.max(0, totalSeconds * 1000);
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return `${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
