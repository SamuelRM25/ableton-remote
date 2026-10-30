import type { Ableton } from "ableton-js";

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

/** Move the arrangement playhead to an absolute position (beats). */
export async function jumpToTime(client: Ableton, beats: number): Promise<void> {
  const target = Math.max(0, beats);
  const now = await client.song.get("current_song_time");
  const delta = target - now;
  if (Math.abs(delta) > 0.001) {
    await client.song.jumpBy(delta);
  }
}

/** Jump to a position and start playing from there. */
export async function playFromTime(client: Ableton, beats: number): Promise<void> {
  await jumpToTime(client, beats);
  await client.song.continuePlaying();
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
