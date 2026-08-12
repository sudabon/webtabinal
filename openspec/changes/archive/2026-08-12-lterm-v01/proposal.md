## Why

cmux の代替として、自分専用のブラウザベースターミナル **WebTabinal** が必要。AI エージェント並列セッションと日常開発を、理想のタブ表示・通知・PWA デスクトップ挙動で扱いたい。v0.1 はローカル完結の最小構成で「自分の道具」の土台を作る。

## What Changes

- Go 製ローカルデーモン（`127.0.0.1` のみ）と React + xterm.js フロントを新規実装する
- 複数 PTY セッションの作成・複製・並べ替え・終了・exited 再起動を提供する
- zsh シェル統合（OSC）でサイドバー 3 段（CWD / コマンド / 状態）をライブ更新する
- 左サイドバー型タブ UI（上部タブバーなし、D&D、幅可変）を実装する
- ブラウザ再接続時にデーモン側リングバッファからスクロールバックを replay する
- コマンド完了通知（macOS 通知 + Dock バッジ）と未読ドットを実装する
- PWA インストール対応し、standalone 時は最後のタブ閉鎖でウィンドウを自動終了する
- localhost 専用の Host/Origin 検証とトークン Cookie 認証を必須化する

## Capabilities

### New Capabilities

- `daemon-core`: 単一 Go バイナリ、config、launchd、CLI、ログ、フロント embed
- `session-pty`: セッションモデル、PTY ライフサイクル、リングバッファ、並び順、状態遷移
- `shell-integration`: zsh 統合スクリプト、OSC パース、未統合フォールバック
- `transport-api`: REST / WebSocket 多重化、再接続 replay、localhost セキュリティ
- `terminal-ui`: 左サイドバー 3 段タブ、xterm.js、キーバインド、空状態
- `notifications`: 完了通知、Dock バッジ、未読完了ドット
- `pwa-lifecycle`: PWA manifest/SW、standalone 終了、beforeunload 確認

### Modified Capabilities

- （なし — 既存 specs は空）

## Impact

- 新規リポジトリ構成: Go デーモン（`cmd/` / `internal/`）+ Vite/React フロント（`web/`）
- 依存: creack/pty、gorilla/websocket、xterm.js、@dnd-kit/sortable、React 18
- ランタイム: launchd LaunchAgent、`~/Library/Application Support/WebTabinal/`、`~/Library/Logs/WebTabinal/`
- 既定: ポート `8642`、新規タブ `Cmd+N`、フォント `Menlo, Monaco, 'Courier New', monospace`（VS Code macOS 既定）
- ユーザー手順: `.zshrc` に統合 1 行追加、PWA インストール、通知許可
- スコープ外（v0.2+）: ペイン分割、デーモン再起動跨ぎ復元、リモート、hooks 連携、テーマ UI
