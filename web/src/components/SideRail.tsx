import {
  IconBook,
  IconStage,
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
  | "device"
  | "stage"
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
  { id: "setlist", label: "Setlist", Icon: IconSetlist },
  { id: "device", label: "Device", Icon: IconMacro },
  { id: "stage", label: "Escenario", Icon: IconStage },
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
        aria-label="Vistas"
        className="shrink-0 flex items-stretch gap-1.5 overflow-x-auto scroll-touch px-2"
        style={{
          background: "linear-gradient(180deg, #1c1e22, #151619)",
          borderTop: "1px solid rgba(0,0,0,0.85)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
          paddingTop: 7,
          paddingBottom: "calc(7px + env(safe-area-inset-bottom))",
        }}
      >
        {NAV.map((item) => (
          <RailKey key={item.id} item={item} active={item.id === active} onSelect={onSelect} compact />
        ))}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Vistas"
      className="shrink-0 flex flex-col items-stretch py-2 px-2 gap-1 overflow-y-auto scroll-touch"
      style={{
        width: 84,
        background: "linear-gradient(90deg, #17181b, #1c1e22)",
        borderRight: "1px solid rgba(0,0,0,0.85)",
        boxShadow: "inset -1px 0 0 rgba(255,255,255,0.04)",
      }}
    >
      {NAV.map((item) => (
        <RailKey key={item.id} item={item} active={item.id === active} onSelect={onSelect} />
      ))}
    </nav>
  );
}

function RailKey({
  item: { id, label, Icon },
  active,
  onSelect,
  compact,
}: {
  item: NavItem;
  active: boolean;
  onSelect: (id: ViewId) => void;
  compact?: boolean;
}) {
  const led = "var(--color-accent-link)";
  return (
    <button
      onClick={() => onSelect(id)}
      aria-current={active ? "page" : undefined}
      className="tactile relative flex flex-col items-center justify-center shrink-0"
      style={{
        gap: 3,
        minWidth: compact ? 64 : undefined,
        padding: compact ? "7px 6px 6px" : "8px 4px 6px",
        borderRadius: 9,
        background: active
          ? "linear-gradient(180deg, #3a3e46, #2b2e34)"
          : undefined,
        boxShadow: active
          ? `inset 0 1px 0 rgba(255,255,255,0.1), inset 0 0 0 1px color-mix(in srgb, ${led} 35%, transparent), 0 1px 0 rgba(0,0,0,0.6)`
          : undefined,
      }}
    >
      {/* LED slit */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 4,
          left: "50%",
          width: 16,
          height: 2,
          marginLeft: -8,
          borderRadius: 1,
          background: active ? led : "rgba(0,0,0,0.55)",
          boxShadow: active ? `0 0 6px ${led}, 0 0 12px color-mix(in srgb, ${led} 50%, transparent)` : "inset 0 0 0 0.5px rgba(255,255,255,0.04)",
        }}
      />
      <span
        className="flex items-center justify-center"
        style={{
          marginTop: 3,
          color: active ? "var(--color-text-1)" : "var(--color-text-2)",
          filter: active ? `drop-shadow(0 0 5px color-mix(in srgb, ${led} 60%, transparent))` : undefined,
        }}
      >
        <Icon size={compact ? 19 : 20} />
      </span>
      <span
        className="label-cap"
        style={{
          fontSize: compact ? 9.5 : 10,
          color: active ? "var(--color-text-1)" : "var(--color-text-3)",
        }}
      >
        {label}
      </span>
    </button>
  );
}
