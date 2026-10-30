import {
  IconBook,
  IconDevice,
  IconLyrics,
  IconMacro,
  IconMixer,
  IconPads,
  IconSession,
  IconSetlist,
  IconSettings,
  IconTransport,
} from "./icons";

export type ViewId =
  | "transport"
  | "session"
  | "pads"
  | "mixer"
  | "macros"
  | "device"
  | "setlist"
  | "lyrics"
  | "settings"
  | "manual";

interface NavItem {
  id: ViewId;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}

const NAV: NavItem[] = [
  { id: "transport", label: "Transport", Icon: IconTransport },
  { id: "session", label: "Session", Icon: IconSession },
  { id: "pads", label: "Pads", Icon: IconPads },
  { id: "mixer", label: "Mixer", Icon: IconMixer },
  { id: "macros", label: "Macros", Icon: IconMacro },
  { id: "device", label: "Device", Icon: IconDevice },
  { id: "setlist", label: "Setlist", Icon: IconSetlist },
  { id: "lyrics", label: "Lyrics", Icon: IconLyrics },
  { id: "settings", label: "Settings", Icon: IconSettings },
  { id: "manual", label: "Manual", Icon: IconBook },
];

interface Props {
  active: ViewId;
  onSelect: (id: ViewId) => void;
  mobile?: boolean;
}

export function SideRail({ active, onSelect, mobile }: Props) {
  if (mobile) {
    return (
      <nav
        className="shrink-0 flex items-stretch gap-1 overflow-x-auto scroll-touch px-2 pb-safe"
        style={{
          background: "var(--color-surface-1)",
          borderTop: "1px solid var(--color-border)",
          paddingTop: 6,
          paddingBottom: "calc(6px + env(safe-area-inset-bottom))",
        }}
      >
        {NAV.map(({ id, label, Icon }) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className="flex flex-col items-center justify-center gap-0.5 rounded-lg shrink-0"
              style={{
                minWidth: 62,
                padding: "6px 4px",
                background: isActive ? "var(--color-surface-3)" : "transparent",
              }}
            >
              <span
                className="flex items-center justify-center"
                style={{
                  color: isActive
                    ? "var(--color-accent-link)"
                    : "var(--color-text-2)",
                }}
              >
                <Icon size={20} />
              </span>
              <span
                className="label-cap"
                style={{
                  color: isActive
                    ? "var(--color-text-1)"
                    : "var(--color-text-3)",
                  fontSize: 8.5,
                }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      className="w-20 shrink-0 flex flex-col items-stretch py-3 gap-1 overflow-y-auto scroll-touch"
      style={{
        background: "var(--color-surface-1)",
        borderRight: "1px solid var(--color-border)",
      }}
    >
      {NAV.map(({ id, label, Icon }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className="group flex flex-col items-center justify-center gap-1 py-2.5 mx-2 rounded-lg active:tactile-active"
            style={{
              background: isActive ? "var(--color-surface-3)" : "transparent",
              transition: "background 120ms var(--ease-instrument)",
            }}
          >
            <span
              className="flex items-center justify-center w-10 h-10 rounded-md"
              style={{
                color: isActive
                  ? "var(--color-accent-link)"
                  : "var(--color-text-2)",
              }}
            >
              <Icon size={22} />
            </span>
            <span
              className="label-cap"
              style={{
                color: isActive
                  ? "var(--color-text-1)"
                  : "var(--color-text-3)",
                fontSize: 9.5,
              }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
