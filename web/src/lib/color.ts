/**
 * Convert a Live color index (integer 0xRRGGBB) to a CSS hex string.
 * Mirrors the behaviour of ableton-js's Color class.
 */
export function colorToHex(color: number | undefined | null): string | undefined {
  if (color === undefined || color === null) return undefined;
  return `#${color.toString(16).padStart(6, "0")}`;
}
