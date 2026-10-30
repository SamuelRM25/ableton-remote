/**
 * Convert a Live colour to a CSS hex string.
 *
 * ableton-js hands colours over in two shapes: a raw integer (0xRRGGBB)
 * from serialised lists, or a `Color` instance (with `.hex` /
 * `numberRepresentation`) from transformed props like clip.color and
 * track.color. Both are accepted here.
 */
export function colorToHex(color: unknown): string | undefined {
  if (color === undefined || color === null) return undefined;
  if (typeof color === "number") return `#${color.toString(16).padStart(6, "0")}`;
  if (typeof color === "string") return color.startsWith("#") ? color : `#${color}`;
  if (typeof color === "object") {
    const c = color as { hex?: unknown; numberRepresentation?: unknown };
    if (typeof c.numberRepresentation === "number") return colorToHex(c.numberRepresentation);
    if (typeof c.hex === "string") return colorToHex(c.hex);
  }
  return undefined;
}
