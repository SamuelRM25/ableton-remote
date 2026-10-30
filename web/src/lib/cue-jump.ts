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

/**
 * Set when we moved the playhead while Live was stopped. Live's Play
 * (start_playing) starts from the START MARKER, not from the playhead, so
 * the transport's Play uses continue_playing while this is set — otherwise
 * selecting a marker and pressing Play sent you back to 1.1.1.
 */
let armedStartBeats: number | null = null;

export function takeArmedStart(): number | null {
  const v = armedStartBeats;
  armedStartBeats = null;
  return v;
}

/** Move the arrangement playhead to an absolute position (beats). */
export async function jumpToTime(client: Ableton, beats: number): Promise<void> {
  const target = Math.max(0, beats);
  const [now, playing] = await Promise.all([
    client.song.get("current_song_time"),
    client.song.get("is_playing"),
  ]);
  const delta = target - now;
  if (Math.abs(delta) > 0.001) {
    await client.song.jumpBy(delta);
  }
  if (!playing) {
    armedStartBeats = target;
    // Also move Live's start marker, so the space bar / Live's own Play
    // button start from here too.
    await client.song.set("start_time" as any, target as any).catch(() => {});
  } else {
    armedStartBeats = null;
  }
}

/** Jump to a position and start playing from there. */
export async function playFromTime(client: Ableton, beats: number): Promise<void> {
  await jumpToTime(client, beats);
  armedStartBeats = null;
  await client.song.continuePlaying();
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
      const [playing, posRaw, tempoRaw, num, den] = await Promise.all([
        client.song.get("is_playing"),
        client.song.get("current_song_time"),
        client.song.get("tempo"),
        client.song.get("signature_numerator"),
        client.song.get("signature_denominator"),
      ]);
      if (cancelled) return;
      if (!playing) {
        await jumpToTime(client, target);
        onDone?.(true);
        return;
      }
      const quarterMs = 60000 / (tempoRaw > 0 ? tempoRaw : 120);
      const barQ = ((num > 0 ? num : 4) * 4) / (den > 0 ? den : 4);
      const pos = Number(posRaw) + (performance.now() - asked) / 2 / quarterMs;
      let remainingQ = barQ - (((pos % barQ) + barQ) % barQ);
      if (remainingQ * quarterMs < 120) remainingQ += barQ;
      const downbeat = pos + remainingQ;
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
