## 1. Daemon single-instance

- [x] 1.1 Detect when `127.0.0.1:<port>` is already accepting connections at `serve` start
- [x] 1.2 If already listening, skip bind and exit successfully (or equivalent hand-off) instead of failing
- [x] 1.3 Add tests for the already-bound case

## 2. Native app shell

- [x] 2.1 Add a macOS `.app` target that bundles `webtabinal` as a sidecar
- [x] 2.2 On launch, probe the configured port; spawn `webtabinal serve` if nothing is listening
- [x] 2.3 Detach the spawned daemon from the app process so Force Quit does not kill sessions (or document LaunchAgent as the KeepAlive path)
- [x] 2.4 Wait until the daemon responds, then load the URL in WKWebView
- [x] 2.5 On probe/spawn timeout, show an error that includes the daemon log path
- [x] 2.6 Set window title to `WebTabinal` and use `icon.svg`-derived AppIcon

## 3. Window lifecycle

- [x] 3.1 Closing the native window does not stop the daemon
- [x] 3.2 Confirm `quit_when_no_tabs` still closes the window only, same as PWA standalone
- [x] 3.3 Reopening the `.app` attaches to the existing daemon and existing sessions

## 4. Build and docs

- [x] 4.1 Add `make desktop` (or equivalent) to build the `.app`
- [x] 4.2 Update README: recommended Dock entry is the `.app`; LaunchAgent and PWA remain optional
- [x] 4.3 Manually verify cold start, warm start (LaunchAgent already up), and window close
