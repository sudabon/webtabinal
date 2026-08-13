# WebTabinal

macOS 向けのローカル専用ブラウザターミナルです。Go デーモンが PTY を管理し、React + xterm.js が描画します。推奨のデスクトップ入口はネイティブ `.app` です（Dock / Finder から開くと、未起動ならデーモンも起動します）。

## クイックスタート（推奨: デスクトップアプリ）

```bash
# フロントエンド・デーモン・.app をビルド
make desktop

# Dock / Finder から開く（未起動ならデーモンを起動してウィンドウを表示）
open bin/WebTabinal.app
```

ウィンドウを閉じてもデーモンとセッションは残ります。再オープンすると既存デーモンに再接続します。

## CLI で起動する場合

```bash
# フロントエンドとデーモンをビルド
make build

# フォアグラウンドで起動
./bin/webtabinal serve

# UI を開く（ブラウザ）
./bin/webtabinal open
# → http://127.0.0.1:8642
```

## シェル連携

セッション起動時に zsh 統合を自動で読み込むため、`~/.zshrc` への追記は不要です。これによりタブのカレントディレクトリ・実行中コマンド・状態が更新されます。

他の端末でも同じスクリプトを使いたい場合のみ、次の 1 行を `~/.zshrc` に追加します。

```zsh
[[ -n "$WEBTABINAL_SESSION_ID" ]] && source "$HOME/Library/Application Support/WebTabinal/integration.zsh"
```

## LaunchAgent（任意: ログイン時の常駐）

`.app` がデーモンを起動できるため必須ではありません。ログイン時から常駐させたい場合や、アプリ強制終了後も KeepAlive で復帰させたい場合に使います。

```bash
make build
./bin/webtabinal install
./bin/webtabinal status
./bin/webtabinal open
```

アンインストール: `./bin/webtabinal uninstall`

## デフォルト値

| 項目 | 値 |
|------|--------|
| Name | WebTabinal (`webtabinal` CLI) |
| `port` | `8642`（`127.0.0.1` のみ） |
| `shell` | `/bin/zsh` |
| `font_family` | `Menlo, Monaco, 'Courier New', monospace`（VS Code の macOS デフォルト） |
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
| 新しいタブ | `Cmd+N`（またはサイドバーの ＋） |
| タブ切り替え | `Cmd+1` … `Cmd+9` |
| 設定 | `~/Library/Application Support/WebTabinal/config.json`（32バイトのランダムな `auth_token` を含むため、共有・コミットしないでください） |
| ログ | `~/Library/Logs/WebTabinal/daemon.log` |

## PWA（任意）

Chrome の「インストール」または Safari の「Dock に追加」から追加できます。推奨の Dock 入口は `.app` ですが、PWA もそのまま使えます。standalone / ネイティブウィンドウでは最後のタブを閉じるとウィンドウも終了します（デーモンは常駐のまま）。この終了挙動は `quit_when_no_tabs` を `false` にすると無効化できます。

## 開発

```bash
# 推奨: フロントエンドをビルドし、埋め込みパスへコピーしたうえでデーモンをビルドする
make build
./bin/webtabinal serve
```

UI を動かす目的で `go run ./cmd/webtabinal serve` や `go build` 単体は使わないでください。
これらでは埋め込みの `index.html` が「Frontend not built」のプレースホルダーのままになります。デーモンは起動して警告を出しますが、ブラウザには空のページが表示されます。必ず先に `make build` を実行してください（少なくとも Web アプリをビルドし、`internal/static/dist` へコピーしてください）。

フロントエンドのみの開発では Vite の開発サーバーを使います。

```bash
cd web
npm run dev
```
