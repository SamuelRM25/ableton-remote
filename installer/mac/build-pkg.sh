#!/bin/bash
# Builds installer/mac/out/DAW-Remote-X.Y.Z.pkg — run on a Mac.
#
#   npm run pkg:mac                       # unsigned (for testing)
#   DEVELOPER_ID_INSTALLER="Developer ID Installer: Tu Nombre (TEAMID)" \
#   NOTARY_PROFILE="dawremote" npm run pkg:mac   # signed + notarized
#
# NOTARY_PROFILE is created once with:
#   xcrun notarytool store-credentials dawremote --apple-id … --team-id … --password <app-specific>
set -euo pipefail
cd "$(dirname "$0")/../.."
ROOT=$(pwd)
VERSION=$(node -p "require('./package.json').version")
OUT="$ROOT/installer/mac/out"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

[ -d build/DAWRemote ] || node scripts/release.mjs

PAYLOAD="$WORK/root/Library/Application Support/DAW Remote"
mkdir -p "$PAYLOAD"
cp -R build/DAWRemote "$PAYLOAD/DAWRemote"
cp installer/mac/resources/Bienvenida.html "$PAYLOAD/"
cp installer/mac/uninstall.command "$PAYLOAD/Desinstalar DAW Remote.command"
cp NOTICE.md "$PAYLOAD/"
find "$PAYLOAD" -name .DS_Store -delete

mkdir -p "$OUT"
pkgbuild \
  --root "$WORK/root" \
  --scripts installer/mac/scripts \
  --identifier app.dawremote.pkg \
  --version "$VERSION" \
  --install-location / \
  "$WORK/DAWRemote-component.pkg"

sed "s/__VERSION__/$VERSION/" installer/mac/distribution.xml > "$WORK/distribution.xml"
PKG="$OUT/DAW-Remote-$VERSION.pkg"
SIGN=()
[ -n "${DEVELOPER_ID_INSTALLER:-}" ] && SIGN=(--sign "$DEVELOPER_ID_INSTALLER")
productbuild \
  --distribution "$WORK/distribution.xml" \
  --resources installer/mac/resources \
  --package-path "$WORK" \
  ${SIGN[@]+"${SIGN[@]}"} \
  "$PKG"

if [ -n "${DEVELOPER_ID_INSTALLER:-}" ] && [ -n "${NOTARY_PROFILE:-}" ]; then
  xcrun notarytool submit "$PKG" --keychain-profile "$NOTARY_PROFILE" --wait
  xcrun stapler staple "$PKG"
fi
echo "✓ $PKG"
[ -z "${DEVELOPER_ID_INSTALLER:-}" ] && echo "  (sin firmar: en otra Mac hay que abrirlo con clic derecho → Abrir)"
exit 0
