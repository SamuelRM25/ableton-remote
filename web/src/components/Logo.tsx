/** DAW Remote mark: rubber key with an amber LED ring and play glyph (logo A). */
export function LogoMark({ size = 32, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ flexShrink: 0, display: "block" }}
    >
      <rect width="120" height="120" rx="28" fill="#1b1c20" />
      <circle cx="60" cy="60" r="38" fill="none" stroke="#3d2c10" strokeWidth="7" />
      <path d="M60 22 A38 38 0 1 1 27.09 79" fill="none" stroke="#FFB23E" strokeWidth="7" strokeLinecap="round" />
      <circle cx="60" cy="60" r="27" fill="#2c2e34" />
      <path d="M53 47 L74 60 L53 73 Z" fill="#FFB23E" />
    </svg>
  );
}
