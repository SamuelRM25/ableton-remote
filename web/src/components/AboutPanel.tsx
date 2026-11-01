import { APP, CREDITS } from "../lib/app-info";

const muted = { color: "var(--color-text-2)", fontSize: 13, lineHeight: 1.55, margin: 0 } as const;
const link = { color: "var(--color-accent-link)", textDecoration: "none" } as const;

/** Ajustes → Acerca de: product, author, contact and third-party credits. */
export function AboutPanel() {
  return (
    <div className="panel" style={{ padding: 20 }}>
      <h3 className="label-cap" style={{ fontSize: 11, margin: "0 0 14px" }}>
        Acerca de
      </h3>

      <div className="flex items-baseline gap-3 flex-wrap">
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 24, letterSpacing: "0.08em" }}>
          DAW REMOTE
        </span>
        <span className="value-mono" style={{ fontSize: 12, color: "var(--color-text-3)" }}>
          v{APP.version} · {APP.buildDate}
        </span>
      </div>
      <p style={{ ...muted, marginTop: 6 }}>Control de tu DAW en vivo desde el iPad, por WiFi.</p>

      <div
        className="well"
        style={{ marginTop: 16, padding: "14px 16px", display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", fontSize: 13 }}
      >
        <span className="label-cap" style={{ fontSize: 10 }}>Desarrollo</span>
        <span style={{ color: "var(--color-text-1)" }}>{APP.author}</span>
        <span className="label-cap" style={{ fontSize: 10 }}>Empresa</span>
        <span style={{ color: "var(--color-text-1)" }}>{APP.company}</span>
        <span className="label-cap" style={{ fontSize: 10 }}>Teléfono</span>
        <span>
          <a href={`tel:${APP.phoneE164}`} style={link}>{APP.phone}</a>
          <span style={{ color: "var(--color-text-3)" }}> · </span>
          <a href={`https://wa.me/${APP.phoneE164.slice(1)}`} target="_blank" rel="noreferrer" style={link}>WhatsApp</a>
        </span>
        <span className="label-cap" style={{ fontSize: 10 }}>Ubicación</span>
        <span style={{ color: "var(--color-text-1)" }}>{APP.location}</span>
        <span className="label-cap" style={{ fontSize: 10 }}>Web</span>
        <span style={{ color: "var(--color-text-1)" }}>{APP.site}</span>
      </div>

      <p style={{ ...muted, marginTop: 14, fontSize: 12 }}>
        © {APP.year} {APP.company}. Todos los derechos reservados. Ableton y Ableton Live son marcas de Ableton AG;
        DAW Remote es un producto independiente, no afiliado ni respaldado por Ableton.
      </p>

      <h4 className="label-cap" style={{ fontSize: 10, margin: "20px 0 8px" }}>
        Créditos de software libre
      </h4>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {CREDITS.map((c) => (
          <li key={c.name} style={{ fontSize: 12.5, color: "var(--color-text-2)", lineHeight: 1.45 }}>
            <a href={c.url} target="_blank" rel="noreferrer" style={{ ...link, fontWeight: 600 }}>{c.name}</a>
            {" "}— {c.by} · <span className="value-mono" style={{ fontSize: 11 }}>{c.license}</span>
            <span style={{ color: "var(--color-text-3)" }}> · {c.note}</span>
          </li>
        ))}
      </ul>
      <p style={{ ...muted, marginTop: 10, fontSize: 12 }}>
        El script de control para Live es una versión modificada de ableton-js © Leo Bernard, publicada bajo licencia
        MIT. El texto completo de las licencias va incluido en el archivo NOTICE.md.
      </p>
    </div>
  );
}
