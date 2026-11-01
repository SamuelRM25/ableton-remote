/** Product identity, shown in Ajustes → Acerca de, the manual and backups. */
export const APP = {
  name: "DAW Remote",
  version: __APP_VERSION__,
  buildDate: __BUILD_DATE__,
  site: "dawremote.app",
  author: "Oscar Samuel Ramírez Martínez",
  company: "RS Software Solutions",
  phone: "(+502) 3902-9076",
  phoneE164: "+50239029076",
  location: "Huehuetenango, Guatemala",
  year: 2026,
} as const;

export const CREDITS: { name: string; by: string; license: string; url: string; note: string }[] = [
  {
    name: "ableton-js",
    by: "Leo Bernard",
    license: "MIT",
    url: "https://github.com/leolabs/ableton-js",
    note: "Base del script de control para Live y del cliente de comunicación.",
  },
  { name: "React", by: "Meta Platforms, Inc.", license: "MIT", url: "https://react.dev", note: "Interfaz." },
  { name: "Vite", by: "VoidZero Inc. y colaboradores", license: "MIT", url: "https://vite.dev", note: "Compilación." },
  { name: "Tailwind CSS", by: "Tailwind Labs", license: "MIT", url: "https://tailwindcss.com", note: "Estilos." },
  { name: "Barlow / Barlow Condensed", by: "Jeremy Tribby", license: "SIL OFL 1.1", url: "https://github.com/jpt/barlow", note: "Tipografía." },
  { name: "JetBrains Mono", by: "JetBrains", license: "SIL OFL 1.1", url: "https://www.jetbrains.com/lp/mono/", note: "Tipografía de valores." },
  { name: "DSEG7", by: "Keshikan", license: "SIL OFL 1.1", url: "https://www.keshikan.net/fonts-e.html", note: "Display de 7 segmentos." },
];
