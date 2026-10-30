import { useEffect, useRef, useState } from "react";
import type { Ableton } from "ableton-js";
import { useLiveProp } from "./hooks";

export interface SongClock {
  /** Interpolated arrangement position in BEATS (Live's native unit). */
  beats: number;
  /** Same position as wall-clock seconds at the current tempo. */
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
 * - Units: Live's current_song_time, cue_point.time, jump_by and
 *   loop_start are all in BEATS (quarter notes), not seconds.
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
      const now = pl && at > 0 ? t + ((performance.now() - at) / 1000) * (tp / 60) : t;
      const key = `${formatClock(now, tp, sn)}:${Math.floor(now * 8)}`;
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
  const now = pl && at > 0 ? t + ((performance.now() - at) / 1000) * (tp / 60) : t;
  return buildClock(now, tp, sn, sd, pl);
}

function formatClock(
  beats: number,
  tempo: number,
  beatsPerBar: number,
  beatUnit = 4,
): string {
  return buildClock(beats, tempo, beatsPerBar, beatUnit, true).barsDisplay;
}

function buildClock(
  beatsRaw: number,
  tempo: number,
  beatsPerBarRaw: number,
  beatUnitRaw: number,
  isPlaying: boolean,
): SongClock {
  const safeTempo = tempo > 0 ? tempo : 120;
  const bpb = beatsPerBarRaw > 0 ? Math.floor(beatsPerBarRaw) : 4;
  const unit = beatUnitRaw > 0 ? Math.floor(beatUnitRaw) : 4;
  // Live's beat = quarter note. In x/8 the bar holds numerator eighths,
  // so convert quarter-note beats to signature beats first.
  const totalQuarter = Math.max(0, beatsRaw);
  const totalBeats = (totalQuarter * unit) / 4;
  const bar = Math.floor(totalBeats / bpb) + 1;
  const beat = Math.floor(mod(totalBeats, bpb)) + 1;
  const perBeat = Math.max(1, Math.round(16 / unit));
  const sixteenth = Math.floor(mod(totalBeats * perBeat, perBeat)) + 1;
  return {
    beats: totalQuarter,
    timeSec: (totalQuarter * 60) / safeTempo,
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

/** Bar.beat label (e.g. "17.1") for a position in Live beats. */
export function beatsToBarLabel(beats: number, beatsPerBar = 4, beatUnit = 4): string {
  const sigBeats = (Math.max(0, beats) * beatUnit) / 4;
  const bar = Math.floor(sigBeats / beatsPerBar) + 1;
  const beat = Math.floor(mod(sigBeats, beatsPerBar)) + 1;
  return `${bar}.${beat}`;
}

/** m:ss.cs wall-time formatting for a duration in seconds. */
export function formatTimeMs(totalSeconds: number): string {
  const ms = Math.max(0, totalSeconds * 1000);
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return `${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
