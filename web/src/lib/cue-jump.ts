import type { Ableton } from "ableton-js";

/**
 * Live's arrangement timeline is seconds-based (cue.time, current_song_time)
 * but jumpBy/scrub and loop_start/loop_length are BEATS-based.
 * Convert with the current tempo.
 */
export async function getTempo(client: Ableton): Promise<number> {
  try {
    const t = await client.song.get("tempo");
    return t > 0 ? t : 120;
  } catch {
    return 120;
  }
}

export function secToBeats(sec: number, tempo: number): number {
  return (sec * tempo) / 60;
}

/**
 * Move the arrangement playhead to an absolute time (seconds).
 *
 * Units (verified empirically against Live 12.0.2 — do NOT "fix" by
 * converting): Song.jump_by takes RELATIVE SECONDS, same frame as
 * current_song_time and cue.time. No tempo conversion needed.
 */
export async function jumpToTime(client: Ableton, sec: number): Promise<void> {
  const target = Math.max(0, sec);
  const now = await client.song.get("current_song_time");
  const delta = target - now;
  if (Math.abs(delta) > 0.01) {
    await client.song.jumpBy(delta);
  }
}

/** Jump to a time and start playing from there. */
export async function playFromTime(client: Ableton, sec: number): Promise<void> {
  await jumpToTime(client, sec);
  await client.song.continuePlaying();
}

/**
 * Loop the given time range (seconds). Unlike jump_by, the loop brace
 * IS beats-based (it snaps to the beat grid in Live's UI), so seconds
 * are converted with the current tempo here.
 */
export async function loopRange(
  client: Ableton,
  startSec: number,
  endSec: number,
): Promise<void> {
  const tempo = await getTempo(client);
  const startBeats = Math.max(0, secToBeats(startSec, tempo));
  const lengthBeats = Math.max(1, secToBeats(endSec - startSec, tempo));
  await client.song.set("loop_start", startBeats);
  await client.song.set("loop_length", lengthBeats);
  await client.song.set("loop", true);
}
