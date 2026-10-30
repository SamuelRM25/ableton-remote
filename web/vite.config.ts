import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { abletonWsBridge } from "./vite-plugins/ableton-ws-bridge";

// In dev: Vite serves the SPA on :5173. The ableton-js client builds its
// WebSocket URL as ws://host:port with no path. The ableton-ws-bridge plugin
// attaches to Vite's HTTP server, identifies non-HMR upgrade requests by
// subprotocol, and forwards them to Live's MIDI script on :39031.
//
// In prod: `vite build` outputs to web/dist/. Copy dist/* into
// midi-script/static/. Live's built-in static server serves the SPA and
// the WebSocket from the same origin (:39031), so no bridge is needed.
export default defineConfig({
  plugins: [react(), tailwindcss(), abletonWsBridge()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
  },
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
});
