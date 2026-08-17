## Why

エージェント待ち通知の OSC 9 / OSC 99 経路は実装済みだが、macOS ネイティブ版では WKWebView がページロード中の通知許可要求を拒否するため、通常の初回起動フローで通知が表示されない。また Codex・Claude Code・cursor-agent が WebTabinal の解釈できる通知シーケンスを出すための設定が不完全で、タスク完了や入力待ちを安定して検出できない。

## What Changes

- macOS ネイティブ版では Web Notification API に依存せず、Web UI から Swift ブリッジへ通知要求を渡し、`UNUserNotificationCenter` で通知を表示する
- 通知許可の状態を UI に表示し、ユーザー操作から許可を要求・再確認できるようにする。ブラウザ / PWA では同じ操作から Web Notification 権限を要求する
- 通知クリック時に WebTabinal を前面化し、通知元のセッションへ切り替える。既存の `notification.enabled`、`notification.always`、完了時間による抑制規則は維持する
- Codex は OSC 9 を明示、Claude Code は `Stop` と待ち系 hook、cursor-agent は対応状況を確認できる設定・診断手順へドキュメントを更新する
- OSC 受信からネイティブ通知要求、権限状態、クリックルーティングまでを検証するテストを追加する

## Capabilities

### New Capabilities

- （なし）

### Modified Capabilities

- `notifications`: 実行環境に応じた通知プロバイダー、ユーザー操作による権限取得、権限状態の扱いを明確化する
- `desktop-shell`: Swift ブリッジと macOS User Notifications による表示、前面表示、セッション選択を追加する
- `settings-ui`: 通知の有効化、権限状態、再試行導線を設定画面に追加する

## Impact

- Native desktop: `desktop/Sources/main.swift`、Info.plist、Swift テスト
- Web UI: 通知ディスパッチ、ネイティブブリッジ型、設定画面、フロントエンドテスト
- Integration/docs: Codex・Claude Code・cursor-agent の設定例と診断手順、README
- Dependencies: macOS 標準の UserNotifications framework を使用し、外部依存は追加しない
- Compatibility: デーモンの OSC パーサ、WebSocket `notify` フレーム、設定ファイルスキーマは変更しない
