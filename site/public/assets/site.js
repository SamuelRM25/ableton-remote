// Wires checkout and download buttons to the URLs in config.js.
(function () {
  var cfg = window.DAWREMOTE || {};
  var en = document.documentElement.lang === "en";
  var soon = en ? "Coming soon" : "Muy pronto";

  function wire(selector, table, fallback) {
    document.querySelectorAll(selector).forEach(function (a) {
      var key = a.getAttribute(selector.slice(1, -1));
      var url = table && table[key];
      if (url) {
        a.href = url;
        a.removeAttribute("aria-disabled");
      } else if (fallback) {
        a.href = fallback;
      } else {
        a.setAttribute("aria-disabled", "true");
        a.removeAttribute("href");
        var label = a.querySelector("[data-label]") || a;
        label.textContent = soon;
      }
    });
  }

  var mail = "mailto:" + (cfg.support || "soporte@dawremote.app") + "?subject=" +
    encodeURIComponent(en ? "DAW Remote beta" : "Beta de DAW Remote");
  wire("[data-checkout]", cfg.checkout, null);
  wire("[data-download]", cfg.download, mail);

  document.querySelectorAll("[data-download]").forEach(function (a) {
    if (!(cfg.download || {})[a.getAttribute("data-download")]) {
      var label = a.querySelector("[data-label]");
      if (label) label.textContent = en ? "Join the beta" : "Pedir acceso a la beta";
    }
  });

  var y = document.querySelectorAll("[data-year]");
  y.forEach(function (n) { n.textContent = String(new Date().getFullYear()); });
})();
