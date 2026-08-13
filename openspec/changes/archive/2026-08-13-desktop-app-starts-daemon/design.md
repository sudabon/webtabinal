## Context

現状のデスクトップ入口は Chrome/Safari の PWA である。PWA は `http://127.0.0.1:8642` を開くだけで、`webtabinal serve` を起動できない。デーモンは `./bin/webtabinal serve` か LaunchAgent（`webtabinal install`）に依存する。v0.1 は Electron を非採用し「単一 Go バイナリ + PWA」とした。今回は PWA の制約を残したまま、Dock からの起動でデーモンも立ち上がるようにする。

制約: macOS 個人利用、ループバックのみ、セッションの真実は引き続きデーモン側。

## Goals / Non-Goals

**Goals:**

- Dock / Finder から `.app` を開くと、未起動ならデーモンを起動し UI を表示する
- 既に listen 中なら二重起動せず、既存デーモンの UI を開く
- ウィンドウを閉じてもセッションはデーモンに残る（現行 PWA と同じ）
- アプリアイコンは `icon.svg` 由来の PNG と揃える

**Non-Goals:**

- Electron 化やフロントの Wails 移行
- デーモン再起動をまたぐセッション復元
- Windows / Linux
- コード署名・公証の本番配布パイプライン（個人利用の ad-hoc 署名で可）
- PWA 経路の削除

## Decisions

### D1. 薄い macOS `.app` が既存バイナリを sidecar として起動する

- **選択**: Swift/AppKit（または同等の薄いネイティブ）の `.app` が `Contents/MacOS/webtabinal` を spawn し、WKWebView で `http://127.0.0.1:<port>` を表示する
- **代替**: Electron / Tauri / Wails に UI を移す
- **理由**: デーモンと embed フロントの真実を壊さない。Electron は重い。Tauri は Rust ツールチェーンが増える。Wails は配信モデルが今の `embed.FS` と競合する

### D2. 起動シーケンスは probe → spawn → wait → 表示

- **選択**:
  1. `config.json` の port（無ければ 8642）へ TCP 接続を試す
  2. 失敗なら bundled `webtabinal serve` を spawn（stdout/stderr は既存ログパスへ）
  3. listen できるまで短いリトライ
  4. WKWebView で URL を開く
- **代替**: 常に serve を spawn して bind 失敗に任せる
- **理由**: 既に LaunchAgent や手動 serve が動いている場合にクラッシュやポートエラーを出さない

### D3. `serve` は既に listen 中なら成功として終わる

- **選択**: 同じ loopback:port が使用中なら、自分のものかどうかに関わらず「既に起動済み」とみなして非ゼロで落とさない（またはすぐ exit 0）
- **代替**: 二重起動をエラーにする
- **理由**: アプリ・LaunchAgent・手動 serve が共存してもユーザーが困らない

### D4. ウィンドウ終了ではデーモンを止めない

- **選択**: `.app` が spawn したデーモンも、ウィンドウ close では kill しない。寿命は LaunchAgent と同じ「明示的 uninstall / プロセス終了まで」
- **代替**: アプリが起動した子プロセスだけウィンドウ close で止める
- **理由**: 「真実はデーモン側」。誤クローズでセッションを消さない、という v0.1 の前提を保つ

### D5. PWA は残す

- **選択**: Chrome のインストール PWA は引き続き使える。ネイティブ `.app` が推奨デスクトップ入口
- **代替**: PWA を廃止して `.app` のみ
- **理由**: 既存ユーザーとブラウザ開発経路を壊さない

## Risks / Trade-offs

- [WKWebView と Chrome PWA で挙動差（通知、バッジ、Cmd+N）] → 差分を tasks で確認し、不足は WebView 設定かドキュメントで扱う
- [spawn したデーモンの親が `.app` だと、アプリ強制終了で子も死ぬ] → `serve` をセッションから切り離す（`setsid` / launchd bootstrap）か、KeepAlive の LaunchAgent を推奨と明記
- [port 待ちが失敗する] → タイムアウト後にエラーウィンドウ（ログパスを示す）
- [アイコンが PWA キャッシュと二重管理] → `.app` の `AppIcon` は `icon.svg` から生成した PNG を単一ソースにする
- [Gatekeeper] → 個人利用は ad-hoc 署名。配布するなら後続 change で公証

## Migration Plan

1. `.app` バンドルと probe/spawn を実装し、開発者は `make desktop` 相当で起動確認
2. README に「推奨: `.app` を開く」「任意: `webtabinal install` でログイン常駐」を並記
3. 既存 PWA / LaunchAgent ユーザーはそのまま動く
4. ロールバック: `.app` を使わず従来の `serve` + PWA に戻す

## Open Questions

- spawn したデーモンをアプリ終了から切り離すか（D4 の子プロセス問題）。実装時に `setsid` か launchd への委譲を選ぶ
- `webtabinal desktop` CLI を足すか、`.app` の実行ファイルだけにするか
