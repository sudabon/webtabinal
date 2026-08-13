## 1. Scaffold (M1 prep)

- [x] 1.1 Initialize Go module and `cmd/webtabinal` entrypoint with `serve` / `install` / `uninstall` / `status` / `open` stubs
- [x] 1.2 Scaffold Vite + React 18 + TypeScript app under `web/` with xterm.js and basic layout shell
- [x] 1.3 Wire Vite build output into Go `embed.FS` and static file serving from the daemon
- [x] 1.4 Implement config load/create at `~/Library/Application Support/WebTabinal/config.json` with v0.1 defaults (port 8642, VS Code macOS font stack)
- [x] 1.5 Implement rotating file logger at `~/Library/Logs/WebTabinal/daemon.log`

## 2. PTY session core (M1)

- [x] 2.1 Implement session struct, manager, ring buffer, and spawn/close (SIGHUP→SIGKILL) lifecycle
- [x] 2.2 Bind HTTP server to `127.0.0.1` only using configured port
- [x] 2.3 Serve a single-session WebSocket path that forwards PTY I/O (interim) for xterm.js interactivity
- [x] 2.4 Verify M1: one PTY + xterm.js interactive shell works end-to-end

## 3. Transport API and security (M2 prep)

- [x] 3.1 Implement Host/Origin checks and auth token generation + SameSite=Strict cookie + validation middleware
- [x] 3.2 Implement REST: sessions list/create/duplicate/restart/delete, order PUT, config GET/PATCH
- [x] 3.3 Replace interim WS with multiplexed JSON+base64 protocol (`attach`/`input`/`resize`/`replay`/`output`/`state`/`sessions`)
- [x] 3.4 Implement client WS client with reconnect backoff (0.5s–5s), term reset + replay on attach

## 4. Shell integration (M2)

- [x] 4.1 Embed and write versioned `integration.zsh` on daemon start; document `.zshrc` one-liner
- [x] 4.2 Implement OSC 7 / 133 / 9973 parser on PTY stream; update CWD/command/state; forward bytes to clients
- [x] 4.3 Implement non-integrated fallback (`TIOCGPGRP` + process name) and `Integrated` flag
- [x] 4.4 Broadcast `state` for all sessions; verify multi-session live sidebar fields update

## 5. Terminal UI — sidebar and tabs (M2–M3)

- [x] 5.1 Build left sidebar (no top tab bar), resizable 160–480px with width persisted via config API
- [x] 5.2 Implement three-row tab cells (CWD basename / command / state+elapsed) with active highlight and tooltips
- [x] 5.3 Add New Tab (append, CWD `~`), context menu (duplicate / restart / close), running-close confirm
- [x] 5.4 Integrate @dnd-kit/sortable reorder committing `PUT /api/sessions/order`
- [x] 5.5 Wire xterm addons (fit / webgl+canvas fallback / search / web-links), scrollback/font settings, IME, copy behavior
- [x] 5.6 Add keyboard shortcuts Cmd+1..9 and Cmd+N (new tab); set `document.title` to `<dirname> — WebTabinal`
- [x] 5.7 Empty state UI + auto-create one session when list is empty at startup

## 6. Notifications and PWA (M4)

- [x] 6.1 Request notification permission on first PWA launch; implement completion notifications with suppression and min_duration rules
- [x] 6.2 Implement unread completion dots and Dock badge via `navigator.setAppBadge()`
- [x] 6.3 Add `manifest.webmanifest`, icons, and minimal service worker for installability
- [x] 6.4 Implement standalone quit-when-no-tabs (`window.close` + empty-state fallback) gated by `quit_when_no_tabs`
- [x] 6.5 Implement `beforeunload` when any session is running (respect confirm setting)

## 7. Lifecycle polish and packaging (M5)

- [x] 7.1 Harden attach replay chunking and multi-tab reconnect restore of scrollback
- [x] 7.2 Implement exited tab UX (keep tab, restart/close) and `close_tab_on_clean_exit` behavior
- [x] 7.3 Complete launchd plist generation for `install`/`uninstall`/`status` and `open` URL helper
- [x] 7.4 Document naming (`WebTabinal` / `webtabinal`), port 8642, Cmd+N, and VS Code font defaults in README
- [x] 7.5 Smoke-test M1–M5 acceptance checklist against `terminal-app-spec-v0.1.md` scope
