import type { Plugin, ViteDevServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";

/**
 * Bridges the ableton-js WebSocket (which always connects to ws://host:port
 * with no path) through Vite's dev server port, so the SPA can use
 * `ws://${location.host}` regardless of dev or prod.
 *
 * - In dev, ableton-js connects to ws://<mac-ip>:5173. Vite's HMR uses the
 *   "vite-hmr" subprotocol, so we can tell them apart and forward only
 *   ableton-js traffic to ws://127.0.0.1:39031.
 * - In prod, Live's built-in static server handles both SPA and WS on the
 *   same port (39031), no proxy needed.
 */
export function abletonWsBridge(): Plugin {
  return {
    name: "ableton-ws-bridge",
    configureServer(server: ViteDevServer) {
      const target = process.env.ABLETON_WS_TARGET ?? "ws://127.0.0.1:39031";
      const wss = new WebSocketServer({ noServer: true });

      server.httpServer?.on("upgrade", (req, socket, head) => {
        const protocol = req.headers["sec-websocket-protocol"];
        if (protocol === "vite-hmr" || protocol === "vite-hmr-2") return;

        wss.handleUpgrade(req, socket, head, (client) => {
          const upstream = new WebSocket(target);
          let opened = false;
          let closed = false;

          const cleanup = () => {
            if (closed) return;
            closed = true;
            try { client.close(); } catch {}
            try { upstream.close(); } catch {}
          };

          upstream.on("open", () => {
            opened = true;
          });
          upstream.on("message", (data: WebSocket.RawData) => {
            if (client.readyState === client.OPEN) client.send(data);
          });
          upstream.on("close", cleanup);
          upstream.on("error", cleanup);

          client.on("message", (data: WebSocket.RawData) => {
            if (opened && upstream.readyState === upstream.OPEN) {
              upstream.send(data);
            } else {
              // buffer until upstream is open
              upstream.once("open", () => upstream.send(data));
            }
          });
          client.on("close", cleanup);
          client.on("error", cleanup);
        });
      });

      server.httpServer?.on("close", () => wss.close());
    },
  };
}
