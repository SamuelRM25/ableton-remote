# Registro de cambios — DAW Remote

Formato: [versionado semántico](https://semver.org/lang/es/) — MAYOR.MENOR.PARCHE.
Cada versión nueva se anota aquí arriba, con fecha.

## 1.1.0 — 2026-11-01

### Licencias
- Pantalla de activación: prueba gratis de 14 días (solo correo) o clave de licencia.
- La licencia queda en la computadora donde corre Live, firmada digitalmente (Ed25519) y atada a esa computadora.
- Funciona 30 días sin internet; se renueva sola cada vez que el iPad tiene conexión.
- Una licencia que vence nunca interrumpe un show: el cambio se aplica al siguiente arranque de Live.
- El script de Live rechaza el control sin licencia (no basta con modificar la app).
- Ajustes → Licencia: plan, vencimiento, verificar ahora, desactivar esta computadora.

### Actualizaciones
- Ajustes → Actualizaciones: busca, descarga e instala versiones nuevas desde el iPad.
- Cada paquete va firmado; la computadora rechaza cualquier archivo alterado.
- Se aplican la próxima vez que abres Live y no se pueden instalar mientras está reproduciendo.
- Aviso automático (una vez al día) cuando hay una versión nueva.

### Instalación
- Instalador para Mac (.pkg): copia DAWRemote a la User Library que use cada versión de Live y abre una guía de 4 pasos.
- Desinstalador incluido.
- Ajustes → Conectar otro dispositivo: código QR con la dirección de la computadora.
- La contraseña y el puerto personalizados ahora viven en `config.json` y sobreviven a las actualizaciones.

### Servidor (base de api.dawremote.app)
- Prueba, activación, renovación y desactivación de licencias; límite de computadoras por clave.
- Conectado a Lemon Squeezy (claves de compra) y claves propias `DAWR-…` para ti, testers y regalos.
- Publicación de versiones (`latest.json`) y descargas.

## 1.0.0 — 2026-11-01

Primera versión con nombre propio (antes "Ableton Remote").

### Nombre y créditos
- La app, el manual, el instalador y el script de Live pasan a llamarse **DAW Remote**.
  En Live el Control Surface aparece como **DAWRemote**.
- Ajustes → Acerca de: versión, autor (Oscar Samuel Ramírez Martínez), empresa
  (RS Software Solutions), contacto, ubicación y créditos de software libre.
- NOTICE.md con las licencias de terceros (ableton-js MIT, React, Vite, Tailwind, tipografías OFL).
- Los respaldos nuevos se llaman `daw-remote-…json`; los respaldos viejos se siguen pudiendo restaurar.

### Funciones incluidas
- Diseño "hardware de estudio": display VFD, LEDs, knobs y faders táctiles.
- Transport: REC (arrangement), Session Record, loop, click, overdub, tap tempo y dial de tempo.
- Play arranca desde la canción, parte o marca elegida aunque Live esté detenido.
- Session (grid de clips), Pads 8×8, Mixer con ruteo de Live 12, Macros + Parámetros de devices.
- Setlist: En vivo, Armar y Marcas. Encadenar canciones, loop hasta el siguiente localizador
  y entrada con conteo sincronizada al compás real (respeta cambios de compás, p. ej. un 5/4 dentro de 4/4).
- Armar setlists: varios setlists, duración exacta medida con Live (respeta cambios de tempo),
  aviso de canciones que ya están en otros setlists y meta de minutos.
- Escenario: vista grande con setlist, proyecto, canción y parte actuales, lo que sigue y el tiempo restante.
- Letras, manual integrado y respaldo/restauración de todos los datos.
- Conexión estable: reconexión automática, pantalla siempre encendida y medidores limitados a 30 Hz
  para bajar la latencia.
