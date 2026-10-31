/**
 * Live's real bar grid.
 *
 * Positions in Live are quarter-note beats from the start of the song. To
 * turn them into bars you need every time-signature change, which Live's
 * API doesn't list. Assuming one signature from bar 1 breaks the moment a
 * song has, say, one 5/4 bar inside 4/4: everything after it is off by a
 * beat (X.2.1 instead of X.1.1) and every "jump on the next 1" lands on
 * the 2.
 *
 * Instead we ask Live where the playhead is in ITS grid
 * (song.get_current_beats_song_time via the MIDI script's
 * `beat_position`) and derive the exact start of the current bar from it.
 * Every reading is also kept as an anchor, so positions elsewhere in the
 * song (cue labels) use the real grid around them.
 */
import type { Ableton } from "ableton-js";

export interface BarInfo {
  /** Playhead, in quarter-note beats. */
  pos: number;
  /** Bar number (1-based) at the playhead, as Live shows it. */
  bar: number;
  /** Where that bar starts, in quarter-note beats. */
  barStart: number;
  /** Length of that bar in quarter-note beats (5/4 → 5, 6/8 → 3). */
  barQ: number;
  num: number;
  den: number;
  /** false when Live couldn't tell us (older MIDI script): 4/4-from-zero guess. */
  exact: boolean;
}

/** Converts the MIDI script's beat_position reply into a BarInfo. */
export function barInfoFromLive(r: any): BarInfo | null {
  if (!r || typeof r.song_time !== "number" || typeof r.bars !== "number") return null;
  const num = r.num > 0 ? Number(r.num) : 4;
  const den = r.den > 0 ? Number(r.den) : 4;
  const beatQ = 4 / den;
  const subsPerBeat = Math.max(1, Math.round(16 / den));
  const pos = Number(r.song_time);
  // Coarse offset inside the current beat from the sixteenth Live shows…
  const inBeat = ((Math.max(1, Number(r.sub)) - 1) / subsPerBeat) * beatQ;
  // …then snap the beat line to the 1/8-note grid every bar line sits on
  // (bars are always a whole number of eighths), which removes the error.
  const grid = den >= 16 ? 0.25 : 0.5;
  let beatLine = Math.round((pos - inBeat) / grid) * grid;
  if (beatLine > pos + 1e-6) beatLine -= grid;
  const barStart = beatLine - (Math.max(1, Number(r.beats)) - 1) * beatQ;
  const info: BarInfo = { pos, bar: Number(r.bars), barStart, barQ: num * beatQ, num, den, exact: true };
  rememberAnchor(info);
  return info;
}

/** Fallback when the MIDI script is older: assume one signature from bar 1. */
function guessBarInfo(pos: number, num: number, den: number): BarInfo {
  const barQ = (num * 4) / den;
  const k = Math.floor(Math.max(0, pos) / barQ);
  return { pos, bar: k + 1, barStart: k * barQ, barQ, num, den, exact: false };
}

let beatPositionSupported: boolean | null = null;

/** Where the playhead is in Live's own bar grid (one round trip). */
export async function getBarInfo(client: Ableton): Promise<BarInfo> {
  if (beatPositionSupported !== false) {
    try {
      const r = await client.getProp("song", undefined, "beat_position");
      const info = barInfoFromLive(r);
      if (info) {
        beatPositionSupported = true;
        return info;
      }
    } catch {
      beatPositionSupported = false;
    }
  }
  const [pos, num, den] = await Promise.all([
    client.song.get("current_song_time"),
    client.song.get("signature_numerator"),
    client.song.get("signature_denominator"),
  ]);
  return guessBarInfo(Number(pos), Number(num), Number(den));
}

export function isBeatPositionSupported(): boolean | null {
  return beatPositionSupported;
}
export function markBeatPositionUnsupported() {
  beatPositionSupported = false;
}

/* ------------------------------------------------------------------ */
/* Anchors: real bar lines seen while playing, for labels elsewhere     */
/* ------------------------------------------------------------------ */

interface Anchor {
  barStart: number;
  bar: number;
  barQ: number;
}
const anchors: Anchor[] = [];

function rememberAnchor(i: BarInfo) {
  const idx = anchors.findIndex((a) => Math.abs(a.barStart - i.barStart) < 0.01);
  const a = { barStart: i.barStart, bar: i.bar, barQ: i.barQ };
  if (idx >= 0) anchors[idx] = a;
  else {
    anchors.push(a);
    anchors.sort((x, y) => x.barStart - y.barStart);
    if (anchors.length > 4000) anchors.splice(0, anchors.length - 4000);
  }
}

/**
 * Bar & beat of any position, using the closest real bar line Live showed
 * us before it (falls back to one signature from bar 1).
 */
export function barBeatAt(beats: number, fallbackNum = 4, fallbackDen = 4): { bar: number; beat: number } {
  let a: Anchor | null = null;
  for (const x of anchors) {
    if (x.barStart <= beats + 1e-6) a = x;
    else break;
  }
  const base = a ?? { barStart: 0, bar: 1, barQ: (fallbackNum * 4) / fallbackDen };
  const beatQ = 4 / fallbackDen;
  const inside = Math.max(0, beats - base.barStart);
  const k = Math.floor(inside / base.barQ + 1e-9);
  const inBar = inside - k * base.barQ;
  return { bar: base.bar + k, beat: Math.floor(inBar / beatQ + 1e-9) + 1 };
}
