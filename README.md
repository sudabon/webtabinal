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
| `port` | `8642` (`127.0.0.1` only) |
| `shell` | `/bin/zsh` |
| `font_family` | `Menlo, Monaco, 'Courier New', monospace` (VS Code macOS default) |
| `font_size` | `14` |
| `scrollback_lines` | `10000` |
| `ring_buffer_bytes` | `5 MiB` |
| `sidebar_width` | `240` |
| `notification.enabled` | `true` |
| `notification.always` | `false` |
| `notification.min_duration_ms` | `0` |
| `notification.sound` | `false`（v0.1 では未実装） |
| `confirm_close_running` | `true` |
| `copy_on_select` | `false` |
| `quit_when_no_tabs` | `true` |
| `close_tab_on_clean_exit` | `false` |
| New tab | `Cmd+N` (or sidebar ＋) |
| Tab switch | `Cmd+1` … `Cmd+9` |
| Config | `~/Library/Application Support/WebTabinal/config.json`（32バイトのランダムな `auth_token` を含むため、共有・コミットしないでください） |
| Logs | `~/Library/Logs/WebTabinal/daemon.log` |

## PWA

Chrome「インストール」または Safari「Dock に追加」。standalone では最後のタブを閉じるとウィンドウも終了します（デーモンは常駐のまま）。この終了挙動は `quit_when_no_tabs` を `false` にすると無効化できます。

## Dev

```bash
# Recommended: build the frontend, copy it to the embed path, and build the daemon
make build
./bin/webtabinal serve
```

Frontend-only development uses the Vite dev server:

```bash
cd web
npm run dev
```
