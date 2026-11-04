#!/usr/bin/env node
/**
 * Wraps the legal and welcome page bodies in site/src/ with the site's
 * header and footer and writes them into site/public/. The home pages
 * (public/index.html, public/en/index.html) are edited directly.
 *
 *   node site/build.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pub = join(here, "public");

const L = {
  es: {
    home: "/", skip: "Saltar al contenido", nav: "Principal", legal: "Legal", homeLabel: "DAW Remote, inicio",
    links: [["/#funciones", "Funciones"], ["/#precios", "Precios"], ["/#preguntas", "Preguntas"]],
    cta: ["/#descargar", "Probar gratis"],
    foot: [["/terminos/", "Términos"], ["/privacidad/", "Privacidad"], ["/reembolsos/", "Reembolsos"]],
    trademark: "Ableton y Ableton Live son marcas de Ableton AG. DAW Remote es un producto independiente, no afiliado ni respaldado por Ableton.",
  },
  en: {
    home: "/en/", skip: "Skip to content", nav: "Main", legal: "Legal", homeLabel: "DAW Remote, home",
    links: [["/en/#features", "Features"], ["/en/#pricing", "Pricing"], ["/en/#faq", "FAQ"]],
    cta: ["/en/#download", "Try free"],
    foot: [["/en/terms/", "Terms"], ["/en/privacy/", "Privacy"], ["/en/refunds/", "Refunds"]],
    trademark: "Ableton and Ableton Live are trademarks of Ableton AG. DAW Remote is an independent product, not affiliated with or endorsed by Ableton.",
  },
};

// [source, lang, output path, other-language path, title, description]
const pages = [
  ["legal/terminos.es.html", "es", "terminos", "en/terms", "Términos de uso", "Términos de uso de DAW Remote."],
  ["legal/privacidad.es.html", "es", "privacidad", "en/privacy", "Política de privacidad", "Qué datos guarda DAW Remote y para qué."],
  ["legal/reembolsos.es.html", "es", "reembolsos", "en/refunds", "Política de reembolsos", "Reembolso dentro de los 7 días después de la compra."],
  ["legal/terms.en.html", "en", "en/terms", "terminos", "Terms of use", "DAW Remote terms of use."],
  ["legal/privacy.en.html", "en", "en/privacy", "privacidad", "Privacy policy", "What data DAW Remote keeps and why."],
  ["legal/refunds.en.html", "en", "en/refunds", "reembolsos", "Refund policy", "Refunds within 7 days of purchase."],
  ["pages/bienvenida.es.html", "es", "bienvenida", "en/welcome", "Bienvenido", "Cómo empezar a usar DAW Remote."],
  ["pages/welcome.en.html", "en", "en/welcome", "bienvenida", "Welcome", "How to get started with DAW Remote."],
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

for (const [src, lang, out, other, title, desc] of pages) {
  const t = L[lang];
  const otherLang = lang === "es" ? "en" : "es";
  const body = readFileSync(join(here, "src", src), "utf8");
  const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — DAW Remote</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="https://dawremote.app/${out}/">
<link rel="alternate" hreflang="${lang}" href="https://dawremote.app/${out}/">
<link rel="alternate" hreflang="${otherLang}" href="https://dawremote.app/${other}/">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#0d0e10">
<link rel="stylesheet" href="/assets/site.css">
</head>
<body>
<a class="skip" href="#main">${t.skip}</a>
<header class="top">
  <div class="wrap">
    <a class="brand" href="${t.home}" aria-label="${t.homeLabel}"><img src="/assets/brand/dawremote-logo-dark.svg" alt="DAW Remote" width="190" height="36"></a>
    <nav class="nav" aria-label="${t.nav}">
${t.links.map(([h, l]) => `      <a href="${h}">${l}</a>`).join("\n")}
      <a class="lang" href="/${other}/" hreflang="${otherLang}" lang="${otherLang}">${otherLang.toUpperCase()}</a>
      <a class="btn small primary" href="${t.cta[0]}">${t.cta[1]}</a>
    </nav>
  </div>
</header>
<main id="main" class="doc">
  <div class="wrap">
${body.trim()}
  </div>
</main>
<footer>
  <div class="wrap">
    <div>
      <p>© <span data-year>2026</span> RS Software Solutions · Huehuetenango, Guatemala</p>
      <p><a href="mailto:soporte@dawremote.app">soporte@dawremote.app</a></p>
      <p>${t.trademark}</p>
    </div>
    <nav aria-label="${t.legal}">
${t.foot.map(([h, l]) => `      <a href="${h}">${l}</a>`).join("\n")}
    </nav>
  </div>
</footer>
<script src="/assets/config.js"></script>
<script src="/assets/site.js"></script>
</body>
</html>
`;
  const file = join(pub, out, "index.html");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  console.log("✓", out);
}
