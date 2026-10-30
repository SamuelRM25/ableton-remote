import { useState } from "react";
import { IconChevronDown } from "../components/icons";

interface Section {
  title: string;
  body: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    title: "Qué es esta app",
    body: (
      <>
        <p>
          Es un control remoto total de <strong>Ableton Live 12</strong> desde
          cualquier dispositivo en tu misma red WiFi (iPad, teléfono,
          computadora). El Mac donde corre Live hace de servidor; el resto
          son controles táctiles.
        </p>
        <p>
          Requisitos: Live abierto, <code>AbletonJS</code> activo como Control
          Surface (Preferences → Link / Tempo / MIDI) y ambos dispositivos
          en el mismo WiFi, abriendo <code>http://IP-DEL-MAC:39031/</code>.
        </p>
      </>
    ),
  },
  {
    title: "Transport (barra inferior, siempre visible)",
    body: (
      <>
        <p>
          La barra de abajo <strong>nunca desaparece</strong>, estés en la
          vista que estés:
        </p>
        <ul>
          <li><strong>◀◀ / ▶▶</strong> — saltar a la marca (cue) anterior / siguiente del arrangement.</li>
          <li><strong>STOP (■)</strong> — para la reproducción.</li>
          <li><strong>PLAY (▶ grande)</strong> — reproduce / pausa. Se ilumina verde sonando.</li>
          <li><strong>REC (●)</strong> — el botón de grabación principal de Live (grabar en el arreglo). Si el transporte está parado, arranca a grabar. El anillo rojo parpadea mientras graba.</li>
          <li><strong>SESSION (● en cuadro)</strong> — Session Record: graba clips nuevos en los tracks armados (R).</li>
          <li><strong>LOOP</strong> — repite el rango del arrangement.</li>
          <li><strong>CLICK</strong> — metrónomo.</li>
          <li><strong>OVR</strong> — overdub del arreglo (en pantallas anchas).</li>
          <li><strong>Tempo (display ámbar)</strong> — arrastra hacia arriba/abajo sobre el número para cambiar BPM: lento = décimas, rápido = BPM enteros. Doble toque redondea. <strong>TAP</strong> marca el tempo a mano.</li>
        </ul>
      </>
    ),
  },
  {
    title: "Session: la cuadrícula de clips",
    body: (
      <>
        <p>
          Es el espejo táctil del <strong>Session View de Live</strong> (la
          cuadrícula, no el timeline). <strong>Columnas = tracks</strong>,{" "}
          <strong>filas = scenes</strong>.
        </p>
        <ul>
          <li><strong>Tocar una celda con color</strong> = lanzar ese clip (respeta tu quantización de lanzamiento).</li>
          <li><strong>Columna derecha (Scene 1, 2…)</strong> = disparar TODA la fila de una vez.</li>
          <li><strong>Celdas vacías</strong> = igual que en Live: si el track está armado (R), tocarla <strong>empieza a grabar un clip ahí</strong>; si no, para lo que suene en ese track.</li>
          <li><strong>Clip encendido con borde blanco y ▶ brillante</strong> = sonando. <strong>Borde rojo y punto parpadeando</strong> = grabando. <strong>▶ parpadeando</strong> = disparado, entra en el próximo tiempo de lanzamiento.</li>
          <li><strong>■ en el header del track</strong> = parar lo que suene en ese track.</li>
          <li><strong>Botón Borrar</strong> (arriba) = modo editar: los clips y scenes se marcan en rojo y <strong>tocarlos los elimina de Live</strong>. Toca <strong>Listo</strong> para salir. Nada se borra sin entrar a este modo a propósito.</li>
          <li><strong>Mantener presionado un clip sonando</strong> (click derecho / long-press) = pararlo.</li>
          <li><strong>M / S / R</strong> del header = mute, solo, arm. En tracks de grupo la <strong>R no aparece</strong> (Live no permite armarlos).</li>
          <li>El mini-fader del header es el volumen (doble toque = 0 dB); los LED verdes son el medidor real.</li>
        </ul>
        <p>Tip de escenario: deja esta vista abierta durante el set — ves de un vistazo qué suena en cada track.</p>
      </>
    ),
  },
  {
    title: "Pads: disparadores 8×8",
    body: (
      <>
        <p>
          64 pads reasignables para disparar clips sin mirar la cuadrícula.
          Toca <strong>Asignar</strong>, luego toca el pad que quieras, elige
          track y escena y pulsa <strong>Asignar</strong> (salta solo al pad
          siguiente). <strong>Vaciar</strong> lo libera y <strong>Auto 8×8</strong>
          copia las primeras 8 pistas × 8 escenas de la Session. Cada pad se
          retroilumina con el color del clip y brilla mientras suena.
        </p>
      </>
    ),
  },
  {
    title: "Canción: las partes de cada canción",
    body: (
      <>
        <p>
          Pensado para sets con una pista de canciones (un clip MIDI vacío por
          canción, con su nombre) y una pista de partes (clips vacíos llamados
          Intro, Verso, Coro…). En <strong>Pistas</strong> eliges cuál es cada
          una y si un pad lanza solo el clip o la escena completa.
        </p>
        <ul>
          <li>Los clips pueden estar en la <strong>Session</strong> o en el <strong>Arreglo</strong>; la app detecta dónde están.</li>
          <li>Arriba aparecen tus canciones; al elegir una, los pads muestran sus partes: los clips de la pista de partes que caen dentro de esa canción.</li>
          <li>En el <strong>Arreglo</strong>, tocar una parte mueve la reproducción a esa parte <strong>en el siguiente compás</strong> (sin salirse del tiempo); si está parado, solo la deja lista para Play.</li>
          <li><strong>Elegir partes</strong>: las escoges a mano y en el orden que quieras (se guarda por canción). <strong>Automático</strong> vuelve al modo por escenas.</li>
          <li><strong>Seguir a Live</strong>: cambia de canción sola cuando Live toca otra.</li>
          <li>El pad que suena brilla, el que está en cola parpadea y el siguiente tiene borde punteado («Sigue»).</li>
        </ul>
      </>
    ),
  },
  {
    title: "Escenario: para que la banda lo lea de lejos",
    body: (
      <>
        <p>
          Canción, parte que suena (enorme, con su color), la que sigue y luces
          de tiempo (la roja es el 1 de cada compás). Usa las pistas de la vista
          Canción; si no están configuradas, usa las marcas del arreglo y cuenta
          cuántos compases faltan para la siguiente.
        </p>
        <p>
          En otro iPad o teléfono abre la misma dirección terminada en
          <code> #escenario</code> (por ejemplo <code>http://192.168.1.94:39031/#escenario</code>):
          solo se ve esta pantalla, sin menús.
        </p>
      </>
    ),
  },
  {
    title: "Mixer: mezcla completa + MAIN",
    body: (
      <>
        <ul>
          <li>Cada tira llena su espacio: <strong>fader de volumen</strong> (arrastra), <strong>medidor estéreo</strong>, <strong>M/S/R</strong>, <strong>knob de pan</strong> y valor en dB.</li>
          <li><strong>MAIN</strong> (primera tira, borde verde) = el master. Sin M/S/R porque el master no los tiene.</li>
          <li>Después de tus tracks vienen los <strong>returns</strong> (borde lila, ↵). Todo lo demás funciona igual en ellos.</li>
          <li><strong>Sends</strong> despliega los envíos; <strong>I/O</strong> despliega entrada/salida (tipo + canal) para rutear cada track.</li>
          <li><strong>+ Audio / + MIDI / + Return</strong> crean canales al final. <strong>Doble-tap al nombre</strong> renombra; en ese modo la ✕ borra (pide confirmación tocando dos veces).</li>
          <li>Los faders se mueven al instante al arrastrar y Live confirma el valor enseguida (modo optimista).</li>
        </ul>
      </>
    ),
  },
  {
    title: "Device: macros y parámetros",
    body: (
      <>
        <p>
          Arriba verás dos filas: <strong>Track</strong> (<strong>MAIN</strong>,
          tus tracks y tus <strong>returns</strong> ↵) y <strong>Device</strong>{" "}
          (los aparatos de ese track/return/master). Toca un device y queda
          seleccionado también en Live.
        </p>
        <ul>
          <li>Arriba a la derecha cambias entre <strong>Macros</strong> y <strong>Parámetros</strong> del mismo device.</li>
          <li><strong>Macros</strong> = knobs grandes de los primeros parámetros (en un Rack son sus macros). Arrastra vertical para mover; doble toque vuelve al valor inicial.</li>
          <li><strong>Parámetros</strong> = TODOS los parámetros con sliders o selectores, con su valor real.</li>
        </ul>
      </>
    ),
  },
  {
    title: "Setlist: canciones y marcas",
    body: (
      <>
        <ul>
          <li><strong>Mark here</strong> crea una marca en Live justo donde va el playhead.</li>
          <li><strong>Tocar una marca</strong> = el playhead salta ahí. <strong>▶</strong> = salta y reproduce desde ahí.</li>
          <li><strong>+ Canción</strong> crea un grupo; con el selector <strong>Canción…</strong> de cada marca la asignas. Doble-tap al nombre para renombrar (el nombre vive en la app: Live no deja renombrar cues).</li>
          <li><strong>＋ en la canción</strong> = crear marca aquí sin escribir: eliges el momento y se crea en Live, se nombra sola en orden (<em>1 - Intro</em>, <em>2 - Verso</em>…) y queda asignada. El menú sugiere el siguiente momento lógico y tiene ★ <strong>favoritas</strong> arriba para las partes que más se repiten (tócale la estrella a cualquier parte para fijarla). Con <strong>+ Nuevo</strong> agregas tus propios momentos. Si el playhead está justo sobre otra marca, avisa y no hace nada (para no borrarla sin querer).</li>
          <li><strong>⟳ en cada marca</strong> = <em>Loop hasta la siguiente marca</em>, igual que la opción del menú de los localizadores en Live: el loop del arreglo va desde esa marca hasta la siguiente y se activa. El botón se ilumina mientras corre; tócalo otra vez para quitar el loop. En la última marca no hay siguiente, así que no hace nada (Live tampoco lo permite).</li>
          <li><strong>Metrónomo en cada marca</strong> = entrar con conteo (muestra el tempo real que está usando, ej. ♩=135 · 4/4): cuenta un compás en pantalla al tempo y compás actuales y al terminar salta y reproduce <em>con el click de Live encendido</em> (luego lo restaura como estaba). Si Live ya está sonando, el conteo <strong>se acopla al compás en curso</strong>: si tocas en el tiempo 3 de 4, cuenta solo 3 y 4 y entra justo en el siguiente 1, sin desfasarse. Si está parado, cuenta un compás completo. Live no tiene conteo para reproducir normal, así que el conteo es visual y el click suena para ayudarte. Tócalo de nuevo para cancelar.</li>
          <li>Cada proyecto de Live tiene <strong>su propio setlist</strong>: al abrir otro set, ves solo sus marcas (arriba dice de qué proyecto son).</li>
<li><strong>✕ borra también en Live</strong> (salta a la marca y la elimina; deshaces con ⌘Z en Live). Si está sonando, el primer toque avisa (hay que pausar para borrar) y el segundo ejecuta. Las manuales solo se borran aquí.</li>
          <li>La <strong>flecha de cada canción la retrae</strong> para no llenar la pantalla; el <strong>lápiz ✎</strong> renombra sin doble-tap (en iPad el doble-tap no es fiable).</li>
          <li>El setlist vive <strong>dentro del proyecto de Live</strong>: iPad, compu y teléfono ven lo mismo. Si abres otro proyecto, ves solo sus marcas (los nombres/tiempos se re-enganchan solos aunque Live cambie los ids internos).</li>
          <li>Mientras suena, la <strong>marca y canción actual se resaltan solas</strong> y la lista te sigue.</li>
          <li><strong>Tocar el nombre de la canción</strong> = saltar a su primera marca. <strong>⭯ Loop canción</strong> = repite solo esa canción (ideal para ensayar); tócalo de nuevo para quitarlo.</li>
          <li>La canción que suena se marca sola (verde) según el playhead.</li>
          <li><strong>Export/Import</strong> guarda tu setlist + canciones en JSON.</li>
        </ul>
        <p>
          Nota honesta: el salto mueve el playhead del <em>arrangement</em>;
          los clips lanzados en Session siguen sonando.
        </p>
      </>
    ),
  },
  {
    title: "Lyrics: letras por marca",
    body: (
      <>
        <p>
          Letras gigantes por marca, para leer de lejos en stage. Flechas
          para cambiar de marca, <strong>Edit</strong> para escribir. Se
          guardan en el dispositivo. Si tus marcas están agrupadas por
          canción en el Setlist, úsalo junto a Lyrics.
        </p>
      </>
    ),
  },
  {
    title: "Settings y conexión",
    body: (
      <>
        <ul>
          <li>Aquí ves el estado, latencia, y cambias host/puerto/password + reconectar.</li>
          <li><strong>Clear local data</strong> borra setlist, letras y bindings del dispositivo.</li>
          <li>Si Safari dice "servidor no responde": mismo WiFi, URL exacta <code>http://IP:39031/</code>, borra caché de Safari, Live abierto con AbletonJS activo.</li>
          <li>Si Live se cierra inesperadamente: al reabrir, <strong>acepta recuperar</strong> el trabajo no guardado. Los backups automáticos viven en <code>[TuProyecto]/Backup/*.als</code>. Guarda con ⌘S de vez en cuando: el setlist de la app se guarda por archivo, y sin archivo no hay a qué anclarlo.</li>
        </ul>
      </>
    ),
  },
  {
    title: "Borrar cosas (dónde se borra cada qué)",
    body: (
      <>
        <ul>
          <li><strong>Clips y scenes</strong>: vista Session → botón <strong>Borrar</strong> → toca el clip o la scene.</li>
          <li><strong>Tracks y returns</strong>: vista Mixer → doble-tap al nombre → ✕ dos veces.</li>
          <li><strong>Devices (efectos/instrumentos)</strong>: vistas Macros o Device → doble-tap al device → tócalo en rojo para borrarlo. Los parámetros sueltos no se pueden borrar (vienen fijos con cada device: para quitar macros, borra el device).</li>
          <li><strong>Marcas</strong>: vista Setlist → ✕ borra también en Live (con confirmación implícita: salta y elimina).</li>
          <li>Todo lo borrable pide <strong>doble confirmación</strong> o un modo explícito: nada se borra de un toque accidental en escenario.</li>
        </ul>
      </>
    ),
  },
  {
    title: "Glosario mínimo",
    body: (
      <>
        <ul>
          <li><strong>Scene</strong> = fila horizontal: todos los clips de esa fila a la vez.</li>
          <li><strong>Quantización de lanzamiento</strong> = la espera (1 beat, 1 compás…) antes de que un clip disparado empiece a sonar. Se configura en Live.</li>
          <li><strong>Appointed device</strong> = el device seleccionado (borde azul en Live). Macros/Device lo siguen.</li>
          <li><strong>Session record</strong> = grabar clips nuevos en slots vacíos.</li>
          <li><strong>Back to arranger / loop del arrangement</strong> = controles del timeline, en vista Transport.</li>
        </ul>
      </>
    ),
  },
];

export function ManualView() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="h-full flex flex-col">
      <div
        className="h-12 shrink-0 flex items-center px-3 sm:px-5"
        style={{
          background: "var(--color-surface-1)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <span className="label-cap">Manual de usuario</span>
      </div>
      <div className="flex-1 min-h-0 overflow-auto scroll-touch" style={{ background: "var(--color-bg)" }}>
        <div className="max-w-3xl mx-auto flex flex-col gap-2" style={{ padding: "16px 16px 40px" }}>
          {SECTIONS.map((s, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className="panel overflow-hidden" style={{ padding: 0 }}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center gap-3 text-left"
                  style={{ padding: "14px 16px" }}
                >
                  <span
                    className="value-mono shrink-0"
                    style={{ fontSize: 11, color: "var(--color-accent-link)", width: 24 }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: "var(--color-text-1)" }}>
                    {s.title}
                  </span>
                  <span
                    style={{
                      display: "inline-block",
                      transform: isOpen ? "rotate(180deg)" : "none",
                      transition: "transform 150ms var(--ease-instrument)",
                      color: "var(--color-text-3)",
                    }}
                  >
                    <IconChevronDown size={16} />
                  </span>
                </button>
                {isOpen && (
                  <div
                    className="manual-body"
                    style={{
                      padding: "0 16px 18px 52px",
                      fontSize: 14,
                      lineHeight: 1.65,
                      color: "var(--color-text-2)",
                    }}
                  >
                    {s.body}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <style>{`
        .manual-body p { margin: 0 0 10px; }
        .manual-body ul { margin: 0 0 10px; padding-left: 18px; }
        .manual-body li { margin-bottom: 6px; }
        .manual-body strong { color: var(--color-text-1); }
        .manual-body code {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-text-1);
          background: var(--color-surface-3);
          padding: 1px 6px;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
