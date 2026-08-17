#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DESKTOP="${ROOT}/desktop"
OUT="${ROOT}/bin/webtabinal-desktop-tests"
WEBTABINAL_ARCH="$(uname -m)"

case "${WEBTABINAL_ARCH}" in
  arm64|x86_64) ;;
  *)
    echo "unsupported macOS architecture: ${WEBTABINAL_ARCH}" >&2
    exit 1
    ;;
esac

mkdir -p "${ROOT}/bin"
echo "==> compiling desktop support tests"
swiftc \
  -target "${WEBTABINAL_ARCH}-apple-macosx13.0" \
  -O \
  -framework UserNotifications \
  -o "${OUT}" \
  "${DESKTOP}/Sources/DesktopSupport.swift" \
  "${DESKTOP}/Tests/main.swift"

echo "==> running desktop support tests"
"${OUT}"
rm -f "${OUT}"
