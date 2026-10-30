import { useEffect, useState } from "react";
import { useAbleton } from "../lib/hooks";
import { useLiveChildProp } from "../lib/list-hooks";
import { Knob } from "../components/Knob";
import { Fader } from "../components/Fader";
import { DevicePicker } from "../components/DevicePicker";

export function DeviceView() {
  const client = useAbleton();
  const [device, setDevice] = useState<any>(null);
  const [version, setVersion] = useState(0);

  useLiveChildProp<any>(client?.song ?? null, "appointed_device");

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    (async () => {
      try {
        const dev = await client.song.get("appointed_device");
        if (cancelled) return;
        setDevice(dev);
      } catch {
        setDevice(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, version]);

  useEffect(() => {
    if (!client) return;
    let off: (() => Promise<unknown>) | null = null;
    (async () => {
      try {
        off = await client.song.addListener("appointed_device", () => {
          setVersion((v) => v + 1);
        });
      } catch {}
    })();
    return () => {
      if (off) void off().catch(() => {});
    };
  }, [client]);

  const name = useLiveChildProp<string>(device, "name");
  const className = useLiveChildProp<string>(device, "class_name");
  const type = useLiveChildProp<number>(device, "type");
  const parameters = useLiveChildProp<any[]>(device, "parameters");

  if (!client) return <Empty>Sin conexión</Empty>;
  const hasDevice = !!device;

  return (
    <div className="h-full flex flex-col">
      <div
        className="h-14 shrink-0 flex items-center px-5 gap-4"
        style={{
          background: "var(--color-surface-1)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div className="flex flex-col">
          <span className="label-cap">Device</span>
          <span
            className="truncate"
            style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-1)" }}
          >
            {name ?? "—"}
          </span>
        </div>
        <span
          className="value-mono"
          style={{ fontSize: 11, color: "var(--color-text-3)" }}
        >
          {className ?? "—"}
        </span>
        <div className="flex-1" />
      </div>

      {client && <DevicePicker client={client} />}

      <div
        className="flex-1 min-h-0 overflow-auto scroll-touch"
        style={{ background: "var(--color-bg)" }}
      >
        {!hasDevice ? (
          <Empty>Elige un track y un device arriba para ver sus parámetros</Empty>
        ) : parameters && parameters.length > 0 ? (
          <div
            className="grid gap-2 p-4"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))",
            }}
          >
            {parameters.map((p, i) => (
              <ParamRow key={p.raw?.id ?? p.nsid ?? i} param={p} index={i} />
            ))}
          </div>
        ) : (
          <Empty>Sin parámetros</Empty>
        )}
      </div>
    </div>
  );
}

function ParamRow({ param, index }: { param: any; index: number }) {
  const name = useLiveChildProp<string>(param, "name");
  const value = useLiveChildProp<number>(param, "value");
  const min = useLiveChildProp<number>(param, "min");
  const max = useLiveChildProp<number>(param, "max");
  const isQuantized = useLiveChildProp<boolean>(param, "is_quantized");
  const valueItems = useLiveChildProp<string[]>(param, "value_items");
  const valueStr = useLiveChildProp<string>(param, "value_string");

  return (
    <div
      className="flex items-center gap-3"
      style={{
        background: "var(--color-surface-1)",
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        padding: "10px 14px",
      }}
    >
      <span
        className="value-mono"
        style={{
          fontSize: 10,
          color: "var(--color-text-3)",
          width: 24,
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <span
        className="truncate"
        style={{
          flex: 1,
          fontSize: 13,
          fontWeight: 500,
          color: "var(--color-text-1)",
        }}
      >
        {name ?? "—"}
      </span>
      {isQuantized && valueItems && valueItems.length > 0 ? (
        <select
          value={value ?? 0}
          onChange={(e) => {
            void param.set("value", Number(e.target.value)).catch(() => {});
          }}
          style={{
            background: "var(--color-surface-2)",
            color: "var(--color-text-1)",
            border: "1px solid var(--color-border)",
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
          }}
        >
          {valueItems.map((v, i) => (
            <option key={i} value={i}>
              {v}
            </option>
          ))}
        </select>
      ) : (
        <>
          <span
            className="value-mono"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-text-1)",
              width: 56,
              textAlign: "right",
            }}
          >
            {valueStr ?? (value !== undefined ? value.toFixed(2) : "—")}
          </span>
          <Fader
            value={value ?? 0}
            min={min ?? 0}
            max={max ?? 1}
            onChange={(v) => {
            void param.set("value", v).catch(() => {});
          }}
            width={120}
            height={20}
            vertical={false}
          />
        </>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex items-center justify-center">
      <span className="label-cap" style={{ color: "var(--color-text-3)" }}>
        {children}
      </span>
    </div>
  );
}
