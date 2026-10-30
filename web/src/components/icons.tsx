import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 22, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...rest,
  };
}

export function IconTransport(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5L16 12L10 15.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconSession(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="11" y="3" width="6" height="6" rx="1" />
      <rect x="19" y="3" width="2" height="6" rx="1" />
      <rect x="3" y="11" width="6" height="6" rx="1" />
      <rect x="11" y="11" width="6" height="6" rx="1" />
      <rect x="19" y="11" width="2" height="6" rx="1" />
      <rect x="3" y="19" width="6" height="2" rx="1" />
      <rect x="11" y="19" width="6" height="2" rx="1" />
      <rect x="19" y="19" width="2" height="2" rx="1" />
    </svg>
  );
}

export function IconPads(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}

export function IconMixer(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="3" width="3" height="18" rx="1" />
      <rect x="10.5" y="3" width="3" height="18" rx="1" />
      <rect x="17" y="3" width="3" height="18" rx="1" />
    </svg>
  );
}

export function IconMacro(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7V4" />
      <path d="M15 9L17 7.5" />
      <path d="M9 9L7 7.5" />
      <path d="M12 21C14 21 16 19 16 16" />
    </svg>
  );
}

export function IconDevice(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 9H17" />
      <path d="M7 13H13" />
      <circle cx="17" cy="14" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function IconSetlist(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 5H19" />
      <path d="M7 9L9 5L11 9" />
      <path d="M13 9L15 5L17 9" />
      <path d="M5 13H19" />
      <path d="M5 17H19" />
    </svg>
  );
}

export function IconLyrics(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 6H20" />
      <path d="M4 10H20" />
      <path d="M4 14H14" />
      <path d="M4 18H17" />
    </svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 1 1 4.3 16.9l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.1 4.31l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06A2 2 0 1 1 19.69 7.1l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

export function IconPlay(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M6 4.5L20 12L6 19.5V4.5Z" />
    </svg>
  );
}

export function IconStop(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <rect x="5" y="5" width="14" height="14" rx="1" />
    </svg>
  );
}

export function IconRecord(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <circle cx="12" cy="12" r="6" />
    </svg>
  );
}

export function IconLoop(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M17 1L21 5L17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 23L3 19L7 15" />
      <path d="M21 13V15A4 4 0 0 1 17 19H3" />
    </svg>
  );
}

export function IconClick(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 12L7 8L11 12L7 16Z" fill="currentColor" stroke="none" />
      <path d="M13 12L17 8L21 12L17 16Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconMetronome(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4L8 20H16L12 4Z" />
      <path d="M9 13L15 13" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5V19" />
      <path d="M5 12H19" />
    </svg>
  );
}

export function IconMinus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 12H19" />
    </svg>
  );
}

export function IconArrowLeft(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M19 12H5" />
      <path d="M12 19L5 12L12 5" />
    </svg>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 12H19" />
      <path d="M12 5L19 12L12 19" />
    </svg>
  );
}

export function IconChevronUp(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 9L12 15L18 9" />
    </svg>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M18 15L12 9L6 15" />
    </svg>
  );
}

export function IconChevronLeft(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M15 18L9 12L15 6" />
    </svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 18L15 12L9 6" />
    </svg>
  );
}

export function IconBook(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20V22H6.5A2.5 2.5 0 0 1 4 19.5V4.5A2.5 2.5 0 0 1 6.5 2Z" />
      <path d="M9 7H15" />
      <path d="M9 11H13" />
    </svg>
  );
}

export function IconStar(props: IconProps) {
  return (
    <svg {...base(props)} fill="none">
      <path d="M12 2.5L14.9 8.6L21.5 9.5L16.7 14.1L17.8 20.6L12 17.5L6.2 20.6L7.3 14.1L2.5 9.5L9.1 8.6L12 2.5Z" />
    </svg>
  );
}

export function IconStarFilled(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M12 2.5L14.9 8.6L21.5 9.5L16.7 14.1L17.8 20.6L12 17.5L6.2 20.6L7.3 14.1L2.5 9.5L9.1 8.6L12 2.5Z" />
    </svg>
  );
}

export function IconPencil(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M17 3A2.85 2.83 0 1 1 11 9L3 17L3 21H7L17 11L17 3Z" />
      <path d="M15 5L19 9" />
    </svg>
  );
}

export function IconBookmark(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M19 21L12 16L5 21V5A2 2 0 0 1 7 3H17A2 2 0 0 1 19 5V21Z" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 12L10 17L20 7" />
    </svg>
  );
}

export function IconX(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M18 6L6 18" />
      <path d="M6 6L18 18" />
    </svg>
  );
}

export function IconArrowUp(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 19V5" />
      <path d="M5 12L12 5L19 12" />
    </svg>
  );
}

export function IconArrowDown(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5V19" />
      <path d="M19 12L12 19L5 12" />
    </svg>
  );
}

export function IconSignal(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 18L8 13L13 16L21 8" />
      <circle cx="8" cy="13" r="1" fill="currentColor" />
      <circle cx="13" cy="16" r="1" fill="currentColor" />
      <circle cx="21" cy="8" r="1" fill="currentColor" />
    </svg>
  );
}

export function IconCpu(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
      <path d="M9 2V5" />
      <path d="M15 2V5" />
      <path d="M9 19V22" />
      <path d="M15 19V22" />
      <path d="M2 9H5" />
      <path d="M2 15H5" />
      <path d="M19 9H22" />
      <path d="M19 15H22" />
    </svg>
  );
}
