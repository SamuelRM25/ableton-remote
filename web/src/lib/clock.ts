import { useEffect, useRef, useState } from "react";
import type { Ableton } from "ableton-js";
import { useLiveProp } from "./hooks";
import { barBeatAt, barInfoFromLive, isBeatPositionSupported, markBeatPositionUnsupported } from "./bar-grid";

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
  /** Start of the current bar, in beats (Live's real grid). */
  barStartBeats: number;
  /** Length of the current bar, in beats. */
  barBeats: number;
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

  // t = song time at the last poll; barStart/bar = Live's real bar grid
  // there (null when the MIDI script can't tell us — then 4/4-from-zero).
  const baseRef = useRef<{ t: number; at: number; barStart: number | null; bar: number }>({
    t: 0,
    at: 0,
    barStart: null,
    bar: 1,
  });
  const liveRef = useRef({ tempo, sigNum, sigDen, isPlaying });
  liveRef.current = { tempo, sigNum, sigDen, isPlaying };

  const [, setTick] = useState(0);
  const lastDisplayRef = useRef("");

  // Poll the playhead and rebase the interpolation.
  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    const fetch = async () => {
      if (isBeatPositionSupported() !== false) {
        try {
          const info = barInfoFromLive(await client.getProp("song", undefined, "beat_position"));
          if (!cancelled && info) {
            baseRef.current = { t: info.pos, at: performance.now(), barStart: info.barStart, bar: info.bar };
            return;
          }
        } catch {
          markBeatPositionUnsupported();
        }
      }
      try {
        const t = await client.song.get("current_song_time");
        if (!cancelled && typeof t === "number") {
          baseRef.current = { t, at: performance.now(), barStart: null, bar: 1 };
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
      const key = `${buildClock(now, tp, sn, liveRef.current.sigDen, pl, baseRef.current).barsDisplay}:${Math.floor(now * 8)}`;
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
  return buildClock(now, tp, sn, sd, pl, baseRef.current);
}

function buildClock(
  beatsRaw: number,
  tempo: number,
  beatsPerBarRaw: number,
  beatUnitRaw: number,
  isPlaying: boolean,
  grid?: { t: number; barStart: number | null; bar: number },
): SongClock {
  const safeTempo = tempo > 0 ? tempo : 120;
  const bpb = beatsPerBarRaw > 0 ? Math.floor(beatsPerBarRaw) : 4;
  const unit = beatUnitRaw > 0 ? Math.floor(beatUnitRaw) : 4;
  const totalQuarter = Math.max(0, beatsRaw);
  // Live's beat = quarter note; one signature beat = 4/unit quarters.
  const beatQ = 4 / unit;
  const barQ = bpb * beatQ;
  // Real grid from Live when we have it (honours signature changes), else
  // one signature from bar 1.
  const anchorStart = grid && grid.barStart !== null ? grid.barStart : 0;
  const anchorBar = grid && grid.barStart !== null ? grid.bar : 1;
  const inside = totalQuarter - anchorStart;
  const k = Math.floor(inside / barQ + 1e-9);
  const bar = anchorBar + k;
  const barStart = anchorStart + k * barQ;
  const inBar = totalQuarter - barStart;
  const beat = Math.floor(inBar / beatQ + 1e-9) + 1;
  const perBeat = Math.max(1, Math.round(16 / unit));
  const sixteenth = Math.floor(mod(inBar / beatQ, 1) * perBeat + 1e-9) + 1;
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
    barStartBeats: barStart,
    barBeats: barQ,
  };
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * Bar.beat label (e.g. "17.1") for a position in Live beats, using the real
 * bar lines Live has shown us (time-signature changes included).
 */
export function beatsToBarLabel(beats: number, beatsPerBar = 4, beatUnit = 4): string {
  const { bar, beat } = barBeatAt(beats, beatsPerBar, beatUnit);
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
