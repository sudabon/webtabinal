#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP_DIR="${ROOT}/bin/WebTabinal.app"
CONTENTS="${APP_DIR}/Contents"
MACOS="${CONTENTS}/MacOS"
RESOURCES="${CONTENTS}/Resources"
DESKTOP="${ROOT}/desktop"

if [[ ! -x "${ROOT}/bin/webtabinal" ]]; then
  echo "missing ${ROOT}/bin/webtabinal; run 'make build' first" >&2
  exit 1
fi

echo "==> assembling app bundle"
rm -rf "${APP_DIR}"
mkdir -p "${MACOS}" "${RESOURCES}"

echo "==> compiling native shell"
swiftc \
  -O \
  -framework AppKit \
  -framework WebKit \
  -o "${MACOS}/WebTabinal" \
  "${DESKTOP}/Sources/main.swift"

cp "${ROOT}/bin/webtabinal" "${MACOS}/webtabinal-daemon"
chmod +x "${MACOS}/WebTabinal" "${MACOS}/webtabinal-daemon"
cp "${DESKTOP}/Info.plist" "${CONTENTS}/Info.plist"

echo "==> generating AppIcon from icon.svg"
swift "${DESKTOP}/scripts/generate-icon.swift" \
  "${ROOT}/web/public/icon.svg" \
  "${RESOURCES}/AppIcon.icns"

# Ad-hoc sign so Gatekeeper is less noisy for personal local builds.
if command -v codesign >/dev/null 2>&1; then
  codesign --force --deep --sign - "${APP_DIR}" >/dev/null 2>&1 || true
fi

echo "built ${APP_DIR}"
echo "launch with: open ${APP_DIR}"
