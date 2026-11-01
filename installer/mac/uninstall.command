#!/bin/bash
# Desinstala DAW Remote. Doble clic para ejecutar.
echo "Desinstalando DAW Remote…"
for d in "$HOME"/Music/Ableton/User\ Library/Remote\ Scripts/DAWRemote; do [ -d "$d" ] && rm -rf "$d" && echo "Borrado: $d"; done
for cfg in "$HOME"/Library/Preferences/Ableton/Live\ */Library.cfg; do
  [ -f "$cfg" ] || continue
  p=$(sed -n '/<UserLibrary>/,/<\/UserLibrary>/s/.*<ProjectPath Value="\([^"]*\)".*/\1/p' "$cfg" | head -1)
  n=$(sed -n '/<UserLibrary>/,/<\/UserLibrary>/s/.*<ProjectName Value="\([^"]*\)".*/\1/p' "$cfg" | head -1)
  d="$p/${n:-User Library}/Remote Scripts/DAWRemote"
  [ -d "$d" ] && rm -rf "$d" && echo "Borrado: $d"
done
sudo rm -rf "/Library/Application Support/DAW Remote" && sudo pkgutil --forget app.dawremote.pkg >/dev/null 2>&1
echo
echo "Listo. Tu licencia y tus ajustes quedan en ~/Library/Application Support/DAW Remote"
echo "(bórrala a mano si no vas a volver a instalar)."
read -n 1 -s -r -p "Presiona una tecla para cerrar"
