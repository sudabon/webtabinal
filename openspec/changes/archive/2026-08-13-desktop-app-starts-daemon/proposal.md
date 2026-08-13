## Why

インストール済みのデスクトップアプリ（PWA）は `http://127.0.0.1:8642` を開くだけで、Go デーモンを起動できない。ブラウザはローカルバイナリを実行できないため、Dock から開いただけでは画面が出ない。LaunchAgent 常駐は回避策になるが、「アプリを開く」操作とデーモン起動が結びついていない。

## What Changes

- Dock / Finder から WebTabinal アプリを起動したとき、デーモンが未起動なら起動し、UI ウィンドウを開く
- 既にデーモンが listen していれば二重起動せず、既存インスタンスの UI を開く
- アプリが起動したデーモンの寿命を定義する（ウィンドウ終了後も常駐するか、このアプリが起動したものだけ止めるか）
- 既存の PWA インストール経路と `webtabinal install`（LaunchAgent）は残す。ネイティブアプリが主たるデスクトップ入口になる
- アプリアイコンは現行 favicon（`icon.svg`）と揃える

## Capabilities

### New Capabilities

- `desktop-shell`: macOS ネイティブアプリがデーモンの生死を見て起動し、ループバック上の UI をウィンドウ表示する

### Modified Capabilities

- `daemon-core`: 単一インスタンス（既に listen 中なら bind せず終了または既存に委譲）と、デスクトップアプリからの起動経路
- `pwa-lifecycle`: ネイティブウィンドウでの last-tab 終了と、PWA standalone の共存。デーモンを「常に launchd 常駐」前提にしない場合の振る舞い

## Impact

- 新規: macOS アプリバンドル（薄いネイティブシェル。WebView がデーモン URL を表示）
- Backend: 既存ポートへの二重 bind 防止、起動済み検知、必要なら CLI（例: `webtabinal desktop`）
- Frontend: 大きな UI 変更は不要。standalone / ネイティブ WebView の `window.close()` 挙動を確認
- 配布: `.app` のビルドとアイコン。LaunchAgent は任意の常駐手段として残る
- 依存: ネイティブシェルの選定（Tauri / 薄い Swift ラッパ等は design で決定）
