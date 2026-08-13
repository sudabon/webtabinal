# WebTabinal

macOS 向けのローカル専用ブラウザターミナルです。Go デーモンが PTY を管理し、React + xterm.js が PWA 上で描画します。

## クイックスタート

```bash
# フロントエンドとデーモンをビルド
make build

# フォアグラウンドで起動
./bin/webtabinal serve

# UI を開く
./bin/webtabinal open
# → http://127.0.0.1:8642
```

## シェル連携（推奨）

`~/.zshrc` に次の 1 行を追加します。

```zsh
[[ -n "$WEBTABINAL_SESSION_ID" ]] && source "$HOME/Library/Application Support/WebTabinal/integration.zsh"
```

この設定がない場合、タブはベストエフォートのプロセス検出にフォールバックし、ライブな CWD は取得できません。

## LaunchAgent としてインストール

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

## PWA

Chrome の「インストール」または Safari の「Dock に追加」から追加できます。standalone では最後のタブを閉じるとウィンドウも終了します（デーモンは常駐のまま）。この終了挙動は `quit_when_no_tabs` を `false` にすると無効化できます。

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
