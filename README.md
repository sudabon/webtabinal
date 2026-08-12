# WebTabinal

Local-only browser terminal for macOS. Go daemon owns PTYs; React + xterm.js renders in a PWA.

## Quick start

```bash
# Build frontend + daemon
make build

# Run in foreground
./bin/webtabinal serve

# Open UI
./bin/webtabinal open
# → http://127.0.0.1:8642
```

## Shell integration (recommended)

Add one line to `~/.zshrc`:

```zsh
[[ -n "$WEBTABINAL_SESSION_ID" ]] && source "$HOME/Library/Application Support/WebTabinal/integration.zsh"
```

Without this, tabs fall back to best-effort process detection (no live CWD).

## Install as LaunchAgent

```bash
make build
./bin/webtabinal install
./bin/webtabinal status
./bin/webtabinal open
```

Uninstall: `./bin/webtabinal uninstall`

## Defaults

| Item | Value |
|------|--------|
| Name | WebTabinal (`webtabinal` CLI) |
| Port | `8642` (`127.0.0.1` only) |
| Font | `Menlo, Monaco, 'Courier New', monospace` (VS Code macOS default), size 14 |
| New tab | `Cmd+N` (or sidebar ＋) |
| Tab switch | `Cmd+1` … `Cmd+9` |
| Config | `~/Library/Application Support/WebTabinal/config.json` |
| Logs | `~/Library/Logs/WebTabinal/daemon.log` |

## PWA

Chrome「インストール」または Safari「Dock に追加」。standalone では最後のタブを閉じるとウィンドウも終了します（デーモンは常駐のまま）。

## Dev

```bash
# Frontend only (API via daemon)
make serve   # builds web into embed path conceptually; prefer:

cd web && npm run build
go run ./cmd/webtabinal serve
```
