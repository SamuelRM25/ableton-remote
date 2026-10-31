import type { Ableton } from "ableton-js";
import { getBarInfo } from "./bar-grid";

/**
 * Units: Live's arrangement API is BEATS-based everywhere —
 * current_song_time, cue_point.time, Song.jump_by, loop_start and
 * loop_length are all in quarter-note beats. No tempo conversion is
 * needed between them; seconds only matter for display.
 */
export async function getTempo(client: Ableton): Promise<number> {
  try {
    const t = await client.song.get("tempo");
    return t > 0 ? t : 120;
  } catch {
    return 120;
  }
}

/**
 * Where Play should start after you picked a song/part/marker while Live
 * was STOPPED.
 *
 * Live ignores jump_by while stopped for the purpose of resuming: both its
 * Play (start_playing → start marker) and continue_playing (→ where it last
 * stopped) would take you back to e.g. bar 225 instead of the song you just
 * chose at 650. So the app remembers the target itself and, on Play, starts
 * from it and corrects the playhead if Live started somewhere else.
 */
let armedStartBeats: number | null = null;
const armListeners = new Set<(v: number | null) => void>();

function setArmed(v: number | null) {
  armedStartBeats = v;
  armListeners.forEach((l) => l(v));
}

export function peekArmedStart(): number | null {
  return armedStartBeats;
}

export function onArmedStartChange(fn: (v: number | null) => void): () => void {
  armListeners.add(fn);
  return () => armListeners.delete(fn);
}

export function takeArmedStart(): number | null {
  const v = armedStartBeats;
  setArmed(null);
  return v;
}

/** Move the arrangement playhead to an absolute position (beats). */
export async function jumpToTime(client: Ableton, beats: number): Promise<void> {
  const target = Math.max(0, beats);
  const [now, playing] = await Promise.all([
    client.song.get("current_song_time"),
    client.song.get("is_playing"),
  ]);
  if (playing) {
    setArmed(null);
    const delta = target - now;
    if (Math.abs(delta) > 0.001) await client.song.jumpBy(delta);
    return;
  }
  // Stopped: remember it for Play, and also try to move Live's own
  // position + start marker (so Live's space bar agrees when it can).
  setArmed(target);
  await client.song.set("current_song_time" as any, target as any).catch(() => {});
  await client.song.set("start_time" as any, target as any).catch(() => {});
}

/**
 * Start playback exactly at `beats`. Works whatever Live decides to resume
 * from: it starts, checks where the playhead really is, and jumps the
 * difference (jump_by is reliable while playing).
 */
export async function startFrom(client: Ableton, beats: number): Promise<void> {
  const target = Math.max(0, beats);
  setArmed(null);
  await client.song.set("current_song_time" as any, target as any).catch(() => {});
  const tempo = await getTempo(client);
  const startedAt = performance.now();
  await client.song.continuePlaying();
  for (let attempt = 0; attempt < 3; attempt++) {
    const pos = Number(await client.song.get("current_song_time"));
    const expected = target + ((performance.now() - startedAt) / 60000) * tempo;
    const off = expected - pos;
    if (Math.abs(off) < 0.5) return;
    await client.song.jumpBy(off);
  }
}

/** Jump to a position and start playing from there. */
export async function playFromTime(client: Ableton, beats: number): Promise<void> {
  await startFrom(client, beats);
}

/**
 * Jump while playing without leaving the beat grid: waits for the next
 * downbeat and jumps RELATIVE to it, so the target lands exactly on the 1.
 * When stopped it just moves the playhead (and arms Play to start there).
 * Returns a cancel function.
 */
export function jumpOnNextDownbeat(
  client: Ableton,
  target: number,
  onDone?: (ok: boolean) => void,
): () => void {
  let cancelled = false;
  let timer: number | null = null;
  void (async () => {
    try {
      const asked = performance.now();
      const [playing, tempoRaw, grid] = await Promise.all([
        client.song.get("is_playing"),
        client.song.get("tempo"),
        getBarInfo(client),
      ]);
      if (cancelled) return;
      if (!playing) {
        await jumpToTime(client, target);
        onDone?.(true);
        return;
      }
      const quarterMs = 60000 / (tempoRaw > 0 ? tempoRaw : 120);
      // Next "1" in Live's REAL grid (a 5/4 bar earlier in the song no
      // longer shifts it onto the 2).
      const pos = grid.pos + (performance.now() - asked) / 2 / quarterMs;
      let downbeat = grid.barStart + grid.barQ;
      while (downbeat - pos < 0) downbeat += grid.barQ;
      let remainingQ = downbeat - pos;
      if (remainingQ * quarterMs < 120) {
        downbeat += grid.barQ;
        remainingQ += grid.barQ;
      }
      timer = window.setTimeout(() => {
        if (cancelled) return;
        client.song
          .jumpBy(target - downbeat)
          .then(() => onDone?.(true))
          .catch(() => onDone?.(false));
      }, Math.max(0, remainingQ * quarterMs - 100));
    } catch {
      onDone?.(false);
    }
  })();
  return () => {
    cancelled = true;
    if (timer !== null) window.clearTimeout(timer);
  };
}

/** Loop the given range of the arrangement (beats) and enable the loop. */
export async function loopRange(
  client: Ableton,
  startBeats: number,
  endBeats: number,
): Promise<void> {
  const start = Math.max(0, startBeats);
  const length = Math.max(1, endBeats - start);
  await client.song.set("loop_start", start);
  await client.song.set("loop_length", length);
  await client.song.set("loop", true);
}
