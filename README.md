# DAW Remote

Control total de Ableton Live 12 desde un iPad por WiFi local. Construido para uso en escenario: latencia sub-frame, multitouch, setlists, lyrics, macros, mixer y todo el Live Object Model expuesto.

> **Estado actual**: build con chequeo de tipos real, todas las vistas implementadas. Probado end-to-end contra un simulador de Live que ejecuta este mismo MIDI script; falta la prueba final con Live 12 real.
>
> **Rediseño "hardware de estudio" (oct 2026)**: chasis grafito, teclas de goma con LED, display VFD ámbar con dígitos de 7 segmentos, knobs con anillo LED, faders de recorrido largo y medidores LED segmentados. Fuentes incluidas en el build (Barlow, Barlow Condensed, JetBrains Mono, DSEG7), así que se ve igual sin internet. Arreglos: REC (ahora es el Rec principal de Live, `record_mode`, y Session Record va aparte), colores de clips/tracks, cuadrícula de Session desalineada, unidades de tiempo (Live usa beats, no segundos), click/overdub/back-to-arranger con booleanos, ruteo I/O con la API de Live 12, lectura del valor real de cada parámetro (`value_string`), reconexión automática si se cae el WiFi.

## Arquitectura

```
┌──────────────────────────────────────────────────────┐
│  Mac                                                  │
│                                                       │
│  Ableton Live 12                                      │
│   └── MIDI Remote Script: ableton-js (forks/Config.py)│
│        ├── WebSocket server en 0.0.0.0:39031          │
│        ├── Static file server (mismo puerto) ← SPA built│
│        └── HMAC-SHA256 con password                    │
│                                                       │
└──────────────┬────────────────────────────────────────┘
               │  WiFi local
┌──────────────▼────────────────────────────────────────┐
│  iPad (Safari / PWA instalada)                        │
│   └── SPA: Vite + React + TypeScript + Tailwind 4     │
│        ├── Conexión WS al script de Live              │
│        ├── Suscripciones a listeners (meters, play…)  │
│        └── UI touch-first con design tokens aplicados │
└───────────────────────────────────────────────────────┘
```

- **Puente**: [ableton-js](https://github.com/leolabs/ableton-js) v5 (MIDI Remote Script) corriendo dentro de Live 12
- **UI**: Vite + React + TypeScript + Tailwind 4, PWA instalable
- **Auth**: HMAC-SHA256 nativa de ableton-js
- **Persistencia**: `localStorage` del iPad (setlist, lyrics, bindings de pads) + botón Export/Import JSON

## Estructura del proyecto

```
ableton-remote/
├── midi-script/                # MIDI Remote Script (se copia a User Library en producción)
│   ├── Config.py               # WEBSOCKET_HOST=0.0.0.0, PASSWORD, PORT
│   ├── static/                 # ← web/dist se copia aquí en build de producción
│   └── …
├── web/                        # SPA del iPad (Vite + React + TS)
│   ├── src/
│   │   ├── views/              # Transport, Session, Pads, Mixer, Macros, Device, Setlist, Lyrics, Settings
│   │   ├── components/         # SideRail, TopBar, TransportBar, ConnectionGate, Knob, Fader, …
│   │   └── lib/                # ableton-js wrapper, hooks, store, settings
│   └── vite.config.ts
├── scripts/
│   └── sync-remote-script.mjs  # Copia web/dist a midi-script/static
├── setlists/                   # (reservado para exports)
└── README.md                   # este archivo
```

## Instalación — para uso en escenario (build de producción)

```bash
# 1. Instalar dependencias
npm install

# 2. (Opcional) Edita el password en midi-script/Config.py
#    PASSWORD = "tu-password-seguro"
#    Por defecto es "ableton" — cámbialo si vas a usarlo en una red compartida.

# 3. Construir la SPA y copiarla al MIDI script
npm run build
node scripts/sync-remote-script.mjs

# 4. Instalar el MIDI script en la User Library de Ableton
mkdir -p ~/Music/Ableton/User\ Library/Remote\ Scripts/
cp -R midi-script ~/Music/Ableton/User\ Library/Remote\ Scripts/DAWRemote

# 5. Abrir Ableton Live 12
#    Preferences → Link / Tempo / MIDI → Control Surface → DAWRemote

# 6. Fija la IP del Mac para que el bookmark del iPad no se rompa con DHCP.
#    Sustituye los valores por los de tu red si difieren:
networksetup -setmanual "Wi-Fi" 192.168.1.94 255.255.255.0 192.168.1.1
networksetup -setdnsservers "Wi-Fi" 192.168.1.1 8.8.8.8 1.1.1.1
#    Para volver a DHCP: networksetup -setdhcp "Wi-Fi"

# 7. En el iPad, abre Safari y ve a http://192.168.1.94:39031/
#    La UI se sirve desde Live y el WebSocket va por el mismo puerto.

# 8. En el iPad, "Share → Add to Home Screen" para instalar la PWA
```

## Si Safari dice "el servidor no responde"

El servidor está verificado: escucha en `0.0.0.0:39031` (dual-stack IPv4+IPv6),
responde `HTTP 200` a `/`, `/manifest.webmanifest`, `/icon-*.svg` y al bundle
JS. Si el iPad no carga, el problema está del lado del iPad:

1. **Mismo WiFi**: el iPad debe estar en la misma red que el Mac (no en red de
   invitados ni en datos móviles). Compruébalo en Settings → Wi-Fi.
2. **Caché de un intento fallido**: Settings → Safari → Clear History and
   Website Data, luego reintenta la URL.
3. **URL exacta**: `http://192.168.1.94:39031/` (con `http://`, sin `https`,
   con el puerto `:39031` y la barra final).
4. **Live abierto con DAWRemote activo**: Preferences → Link / Tempo / MIDI →
   la fila de DAWRemote debe estar presente. Si editaste `midi-script/`,
   reinicia Live para que recargue el script (Live no hace hot-reload de
   Control Surfaces).
5. **Diagnóstico desde el Mac**: `curl -sS -o /dev/null -w "%{http_code}\n"
   http://192.168.1.94:39031/` debe devolver `200`. Y
   `lsof -nP -iTCP:39031` debe mostrar a `Live` en `LISTEN`.
6. **Firewall**: System Settings → Network → Firewall debe permitir Live
   (o estar apagado en red doméstica de confianza).
7. **Pestañas viejas tras actualizar**: si actualizaste la app (`npm run build`
   + sync a `midi-script/static`), **recarga la página en el iPad y en
   cualquier otro navegador donde la tengas abierta**. Los bundles viejos
   en pestañas abiertas siguen corriendo el código anterior hasta recargar.

## Si la consola muestra "Listener X does not exist"

Ese error lo devuelve el script Python cuando se pide `add_listener` para
una prop que Live no expone como observable. Verificado contra Live 12.0.2
vía `get_observable_properties`, estas props **no tienen listener**:

- `song.name` → la app lo lee con `get()` + poll cada 2 s
- `scene.is_empty` → `get()` + poll cada 2 s
- `mixer-device.volume` / `panning` → `get()` + poll cada 1 s, con
  faders optimistas (se mueven al instante al arrastrar)

El resto (`tempo`, `is_playing`, `scenes`, `tracks`, `mute/solo/arm`,
meters, `clip.is_playing`, parámetros de device…) sí tienen listener y
van por push. Los hooks (`useLiveProp` / `useLiveChildProp`) prueban
listener primero y caen a poll automáticamente si Live rechaza, así que
la consola queda limpia por diseño.

Cómo comprobarlo del lado de Live:

```bash
# Ver errores del script en el log de la sesión actual
grep -E "Handler error" ~/Library/Preferences/Ableton/Live\ 12.0.2/Log.txt | tail -5
# Preguntar al propio Live qué props son observables (ej. song)
# (ver probe-observable.mjs en el historial del repo)
```

## Desarrollo con HMR

```bash
npm run dev
# Vite arranca en :5173 con un plugin que puentea el WebSocket hacia :39031
# (Live debe estar corriendo y el MIDI script instalado y activo)
#
# Abre http://<ip-de-tu-mac>:5173/ en el iPad — la app se carga desde Vite
# y se conecta a Live via el puente. Hot reload al guardar.
```

El plugin `web/vite-plugins/ableton-ws-bridge.ts` añade un servidor WebSocket al puerto de Vite, distingue upgrades HMR (subprotocolo `vite-hmr`) de upgrades de ableton-js, y reenvía estos últimos a `ws://127.0.0.1:39031`. En producción este puente no existe: Live sirve la SPA y el WebSocket en el mismo origen (39031).

## Conexión estable y baja latencia

- **Medidores sin atascos**: el MIDI script junta los valores de medidores y posición de reproducción y los manda como máximo 30 veces por segundo, por un carril de baja prioridad. Así nunca retrasan un botón, el resultado de un comando ni un cambio de estado (play, mute, clip lanzado).
- **Sin polling por clip**: el estado "sonando" sale de `playing_slot_index` del track (un listener por track) en vez de preguntarle a cada clip cada 500 ms.
- **Live colgado ≠ desconexión**: los comandos y el heartbeat esperan hasta 10 s antes de dar la conexión por perdida (cargar un set pesado congela Live unos segundos). Un corte real de red se detecta al instante y la app se reconecta sola en ~250 ms.
- **Pantalla siempre encendida**: la app pide *wake lock* para que el iPad no se bloquee (al bloquearse, Safari mata la conexión). Aun así, para escenario: Ajustes → Pantalla → Bloqueo automático → Nunca, o usa Acceso guiado.

## Las 9 vistas

| Vista          | Qué hace                                                                                  |
|----------------|-------------------------------------------------------------------------------------------|
| **Transport**  | Tempo con dial táctil, time signature, loop/punch/overdub, cue points, position, undo/redo |
| **Session**    | Grid clips × scenes con colores reales de Live, M/S/R, faders, meters, headers sticky. Botón **Borrar** = modo editar (tocar clip/scene la elimina de Live) |
| **Pads**       | 8×8 pads reasignables. Cada pad graba un track+scene, muestra color del clip              |
| **Mixer**      | Tiras flexibles a full-área (MAIN master + tracks + returns lila). Fader, meter, M/S/R (R oculta en grupos), pan, sends, panel **I/O** (entrada/salida por track). **+ Audio/MIDI/Return**, doble-tap renombra, borrado con doble confirmación |
| **Macros**     | Selector de track + device arriba (**MAIN, tracks y returns**; sincroniza la selección con Live) y encoders grandes de parámetros |
| **Device**     | Mismo selector + TODOS los parámetros con sliders/selectores y su valor real             |
| **Setlist**    | **Por proyecto** (un setlist por archivo de Live). Cue points de Live + cues manuales. **Click = saltar**, **▶ = reproducir desde ahí**, **metrónomo = entrar con conteo** (1 compás, muestra ♩=tempo real, click de Live desde el downbeat). **+ Canción** agrupa; **＋ = crear marca aquí** con menú de momentos (19 partes + favoritas con ★ + personalizados), auto-nombre secuencial (`1 - Intro`, `2 - Verso`…) y auto-asignación; **✕ borra también en Live**; doble-tap renombra (solo app: Live no deja renombrar cues). Click en canción = ir a su inicio; **Loop canción** para ensayar; follow automático con auto-scroll. Export/import JSON |
| **Lyrics**     | Letras por cue en tipografía display grande, modo editor, persistidas en localStorage     |
| **Settings**   | Conexión (host/port/password), estado, limpiar localStorage                               |
| **Manual**     | Manual de usuario in-app en español: qué hace cada vista, gestos, troubleshooting, glosario |

## Responsive (teléfono / iPad / computadora)

- `<640px` (teléfono): la navegación pasa a **barra inferior** con scroll horizontal; top bar condensada (sin proyecto ni CPU); Session usa celdas compactas; Transport pasa a 1 columna; modales y números usan `clamp()`/`min()` para no desbordar.
- `640–1100px` (iPad): layout completo con side rail.
- `≥1100px` (desktop): layout completo.
- Safe-area (`env()`) en barras inferiores para notch/home-bar; scroll con momentum en iOS; `user-scalable=no` + `touch-action` para que los faders/knobs no peleen con el scroll.

## Persistencia local

- **Setlist, lyrics, bindings de pads** → `localStorage` del iPad
- **Conexión (host/port/password)** → `localStorage` también (sobrevive a recargas)
- **Botón "Export setlist"** en la vista Setlist → descarga `setlist-YYYY-MM-DD.json`
- **Botón "Import setlist"** → sube un JSON exportado previamente
- **Botón "Clear local data"** en Settings → borra todo lo anterior

## Seguridad y red

- **Solo LAN**: el script queda abierto en `0.0.0.0:39031`. La auth HMAC de ableton-js evita que cualquiera con WiFi controle tu sesión, pero el tráfico va en claro (`ws://`, no `wss://`).
- **Para uso fuera del WiFi doméstico**: monta Tailscale o ZeroTier en el Mac para tener una red privada virtual sin exponer nada públicamente.
- **Password**: el primer load en el iPad pide el password y lo guarda en `localStorage`. Si Live rechaza, la app lo indica claramente y permite reintentar.

## Capacidades expuestas (Live Object Model)

Con ableton-js v5 cubrimos el LOM de Live 12 completo:

- **Transport**: play, stop, continue, rec, tap tempo, jump by, scrub
- **Loop de arrangement**: loop_start, loop_length, loop
- **Modo**: punch in/out, overdub, count-in, metronome, automation
- **Clips**: fire, stop, has_clip, create, delete, duplicate, name, color, length, loop_start/end, launch_mode, is_playing/recording, playing_position
- **Scenes**: fire, name, color, tempo/time-sig override
- **Cue points**: prev/next/jump, add/delete/rename, setOrDeleteCue
- **Tracks**: volume, panning, mute, solo, arm, sends, color, name, fold, devices
- **Mixer device**: volume, panning, sends, cue_volume
- **Devices**: parameters (incl. rack macros), chains, drum pads
- **Browser**: load devices/instruments (v3.3+)
- **Edit history**: undo, redo, capture MIDI
- **Tuning system, scale_name, root_note** (Live 12)

## Problemas conocidos / siguiente

- **Setlist "jump to cue"**: el LOM solo expone `jumpToPrevCue` y `jumpToNextCue`. Para saltar a un cue arbitrario por nombre se necesita un handler custom en el MIDI script (add `select_cue` method). Por ahora la lista funciona como setlist + cue list, no como selector directo.
- **Browser load de samples**: limitado por la API de Live; no se puede subir un wav desde el iPad sin tener la ruta en disco del Mac. Documentado pero no implementado.
- **Service worker**: el manifest es suficiente para "Add to Home Screen" en iPad, pero no hay cache offline. Próxima iteración.
- **Realtime MIDI out**: el bridge expone los MIDI note listeners pero no el envío. Documentado en el README de ableton-js.

## Licencia

MIT

## Créditos y licencia

**DAW Remote** v1.0.0 — © 2026 **RS Software Solutions**. Todos los derechos reservados.
Desarrollado por **Oscar Samuel Ramírez Martínez** · Huehuetenango, Guatemala · (+502) 3902-9076.

El script de control para Live es una versión modificada de
[ableton-js](https://github.com/leolabs/ableton-js) © 2022 Leo Bernard, licencia MIT.
Ver [NOTICE.md](NOTICE.md) para todos los componentes de terceros y [CHANGELOG.md](CHANGELOG.md) para el historial.

Ableton y Ableton Live son marcas de Ableton AG. DAW Remote es un producto independiente,
no afiliado ni respaldado por Ableton.
