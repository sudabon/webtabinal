# WebTabinal

macOS 向けのローカル専用ブラウザターミナルです。Go デーモンが PTY を管理し、React + xterm.js が描画します。推奨のデスクトップ入口はネイティブ `.app` です（Dock / Finder から開くと、未起動ならデーモンも起動します）。

## インストール

初回はツールの導入とフロントエンド依存関係のインストールが必要です。これを省略すると `make build` が `tsc: command not found` で失敗します。

### 必要なもの

| ツール | 用途 | 目安 |
|--------|------|------|
| macOS | 実行環境 | — |
| Git | リポジトリの取得 | — |
| Go | デーモンのビルド | `go.mod` のバージョン（現在 1.26.5）以上 |
| Node.js / npm | フロントエンドのビルド | 20.19+ または 22.12+ |
| Xcode Command Line Tools | `make desktop`（`swiftc`） | CLI のみなら不要 |

Homebrew を使う場合の例:

```bash
xcode-select --install
brew install go node
```

入っているかは次で確認できます。

```bash
go version
node -v
npm -v
```

### リポジトリと npm 依存関係

```bash
git clone git@github.com:sudabon/webtabinal.git
cd webtabinal
cd web && npm install && cd ..
```

これ以降は [クイックスタート](#クイックスタート推奨-デスクトップアプリ) に進んでください。依存関係を入れ直すときも `cd web && npm install` です。

## クイックスタート（推奨: デスクトップアプリ）

```bash
# フロントエンド・デーモン・.app をビルド
make desktop

# Dock / Finder から開く（未起動ならデーモンを起動してウィンドウを表示）
open bin/WebTabinal.app
```

継続利用する場合は `/Applications` など固定の場所へコピーしてください。`bin/` 配下の `.app` は `make clean` や再ビルド（`make desktop`）で削除されます。

ウィンドウを閉じてもデーモンとセッションは残ります。再オープンすると既存デーモンに再接続します。

## デスクトップアプリの更新

UI と API は `.app` 内のデーモン（`webtabinal-daemon`）に埋め込まれています。`.app` だけ上書きしても、**起動中の古いデーモンが残っていると旧 UI のまま**になります。

```bash
# アプリを終了し、古いデーモンを止める
osascript -e 'quit app "WebTabinal"'
pkill -f '/webtabinal serve' || true
pkill -f 'webtabinal-daemon serve' || true

# 8642 が空いていることを確認してから
lsof -nP -iTCP:8642 -sTCP:LISTEN

# 新版をビルドして /Applications へ置き換える
make desktop
rm -rf /Applications/WebTabinal.app
cp -R bin/WebTabinal.app /Applications/
```

LaunchAgent（`webtabinal install`）を使っている場合は、置き換え後に新しいバイナリで入れ直してください。

```bash
make build
./bin/webtabinal uninstall
./bin/webtabinal install
```

## CLI で起動する場合

```bash
# フロントエンドとデーモンをビルド
make build

# フォアグラウンドで起動（既にデーモンが listen 中ならその旨を表示して終了）
./bin/webtabinal serve

# UI を開く（ブラウザ）
./bin/webtabinal open
# → http://127.0.0.1:8642
```

## シェル連携

セッション起動時に zsh / bash 統合を自動で読み込むため、`~/.zshrc` や `~/.bashrc` への追記は不要です。これによりタブのカレントディレクトリ・実行中コマンド・状態が更新されます。

他の端末でも同じスクリプトを使いたい場合のみ、次の 1 行を追加します。

```zsh
[[ -n "$WEBTABINAL_SESSION_ID" ]] && source "$HOME/Library/Application Support/WebTabinal/integration.zsh"
```

```bash
[[ -n "$WEBTABINAL_SESSION_ID" ]] && source "$HOME/Library/Application Support/WebTabinal/integration.bash"
```

## 通知

コマンド完了（タブが非アクティブ、またはウィンドウがフォーカスされていないとき）、ターミナルが受け取った OSC 9 / OSC 99 / OSC 777（エージェントの完了・承認待ちなど）、および画面検知による `blocked` 遷移で通知を出します。ネイティブ `.app` では macOS 通知、ブラウザでは Web Notification を使い、両方を同時に出すことはありません。待ち通知と `blocked` 通知は `notification.min_duration_ms` の対象外です。

同じセッションの OSC 待ち通知と画面検知 `blocked` は、4 秒の first-wins 窓で通知を 1 回にまとめます。状態 pill と `agent_state` フレームは抑制しません。ブラウザを閉じても daemon が残っているため、再接続時の `sessions` snapshot が現在の agent state の authoritative な復元元です。

最初に WebTabinal の「設定 → 通知」を開き、「通知を有効にする」がオンであることを確認してください。「システム通知の許可が必要です」と表示されたら「通知を許可」をクリックします。「許可されていません」なら macOS の「システム設定 → 通知 → WebTabinal」、ブラウザ版ならサイト別の通知設定から許可してください。許可状態は「通知」画面を開いたときと、WebTabinal が再びフォーカスされたときに更新されます。

エージェント状態の検出は既定でオンです。`blocked` 通知だけ止めたい場合は「blocked を通知する」をオフにします。状態検出自体をオフにすると pill は消え、既存の OSC 通知は残ります。

### Codex

WebTabinal が未知のターミナル扱いになっても確実に OSC 9 を送るよう、`~/.codex/config.toml` で通知種別と方式を明示します。

```toml
[tui]
notifications = ["agent-turn-complete", "approval-requested"]
notification_method = "osc9"
notification_condition = "unfocused"
```

`notification_condition = "unfocused"` は **Codex が OSC 9 を送る条件**です。前面でも Codex に送らせるには `"always"` にします。WebTabinal の `notification.always` は、**受信済みのイベントを前面のアクティブタブでも表示するか**を決める別の設定です。操作中にも必ず表示したい場合は、Codex 側を `"always"`、WebTabinal 側の「操作中も通知する」をオンにします。詳細は [Codex configuration reference](https://developers.openai.com/codex/config-reference) を参照してください。

### Claude Code

`~/.claude/settings.json` に次のフックを追加します。`Stop` はメインエージェントの応答完了時、`PermissionRequest` は承認ダイアログの直前、`Notification` の `idle_prompt` は入力待ちのアイドル通知時に OSC 9 を送ります。

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "printf '\\033]9;Claude Code turn complete\\007' > /dev/tty"
          }
        ]
      }
    ],
    "PermissionRequest": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "printf '\\033]9;Claude Code needs approval\\007' > /dev/tty"
          }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": "idle_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "printf '\\033]9;Claude Code is waiting for input\\007' > /dev/tty"
          }
        ]
      }
    ]
  }
}
```

`/dev/tty` へ書くことで、フックの標準出力ではなく Claude Code を実行中の WebTabinal セッションへ送ります。フックの仕様は [Claude Code hooks reference](https://code.claude.com/docs/en/hooks) を参照してください。

### Cursor Agent

フィクスチャで検証した Cursor Agent は **`2026.08.11-e8db854`** です。「latest」の無条件保証はありません。

| 状態 | このビルドでの扱い |
|------|-------------------|
| identity | 実行ファイル `agent` / `cursor-agent`、またはそのコマンドライン |
| working | 画面出力の activity（quiet になるまで） |
| idle | プロンプト、またはパターンに合わない静かな画面（unknown → idle） |
| blocked | **未検証**。承認/質問画面の高確度 pattern はバンドルしていない |

このビルドは OSC 0 によるタイトル更新（BEL 終端）のみを出し、WebTabinal が通知として扱う OSC 9 / 99 / 777 は出しません。`osc_authoritative` は false です。OSC 0 / BEL やプロセス存在だけでは `blocked` にしません。

ローカルで文言が変わった場合は、`~/Library/Application Support/WebTabinal/manifests/cursor-agent.json` で上書きし、デーモンを再起動してください（`state.manifest_dir` の変更も再起動後）。失効の切り分けには読み取り専用の診断を使います。

```bash
./bin/webtabinal state snapshot <session-id>
./bin/webtabinal state snapshot <session-id> --lines 20 --buffer active --json
```

デーモンが起動していない場合、このコマンドはデーモンを起動しません。fixture の再採取と manifest 更新は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

### OSC 9 単体プローブ

エージェント側と WebTabinal 側のどちらに原因があるかを切り分けるには、WebTabinal 内のターミナルから次を実行します。

```bash
./scripts/osc9-notification-probe.sh
```

これで通知が出れば WebTabinal の OSC 受信から通知までは正常で、エージェント側の出力設定を確認できます。通知の代わりにタブの未読ドットだけが付く場合も、WebTabinal までイベントが届いているので通知許可とフォーカス条件を確認します。

| 症状 | 切り分け対象 | 確認・対処 |
|------|------------------|------------|
| エージェント完了時に未読ドットも通知も出ない | エージェントのイベント出力 | OSC 9 プローブを実行し、プローブだけ成功するなら Codex / Claude Code の設定と `/dev/tty` 出力を確認する |
| 未読ドットは付くが通知が出ない | WebTabinal の通知有効化・許可 | 「設定 → 通知」で有効化と正規化された許可状態を確認する |
| 背景では出るが前面のアクティブタブでは出ない | アプリのフォーカス抑制 | WebTabinal の「操作中も通知する」をオンにする。Codex が元イベントを送るには `notification_condition = "always"` も必要 |
| 許可状態が「許可されていません」 | macOS / ブラウザの許可 | macOS の「システム設定 → 通知 → WebTabinal」、またはブラウザのサイト設定で許可し、WebTabinal へフォーカスを戻す |
| `.app` 更新後も旧挙動、または通知が重複する | 実行中の旧デーモン / 旧アプリ | [デスクトップアプリの更新](#デスクトップアプリの更新) の手順で古いデーモンを停止し、新しい `.app` から再起動する |
| sidebar に状態 pill が出ない | 状態検出または未検出シェル | 「設定 → 通知」で状態検出がオンか確認する。通常のシェルは `none` のため pill を出さない |
| Cursor の状態が idle のまま / 合わない | 画面再構築・identity・pattern のどれが失効したか | `webtabinal state snapshot <session-id>` で下端行、agent、manifest、match 行を確認する。daemon 未起動なら起動はしない |
| `blocked` なのに通知がない | `notify_on_blocked` / フォーカス / 4 秒 dedupe | 「blocked を通知する」がオンか、前面抑制、直前の OSC 待ち通知との窓を確認する。Cursor の blocked はこのビルドでは未検証 |
| 再接続後に pill が戻らない | 初期 snapshot | daemon が生きていれば `sessions` に `agent_state` が含まれる。daemon ごと落ちていれば状態は復元されない |
| タブ順が勝手に変わる | 自動ソートはしない | `blocked` でも daemon の並びと Cmd+数字は変わらない |

## LaunchAgent（任意: ログイン時の常駐）

`.app` がデーモンを起動できるため必須ではありません。ログイン時から常駐させたい場合や、デーモンが異常終了したときに KeepAlive で復帰させたい場合に使います（正常終了や「既に listen 中」の成功終了では再起動しません）。

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
| `state.enabled` | `true` |
| `state.debounce_ms` | `120`（20–5000） |
| `state.quiescence_ms` | `1500`（0–60000。マニフェスト指定があれば優先） |
| `state.bottom_lines` | `15`（1–200。マニフェスト指定があれば優先） |
| `state.notify_on_blocked` | `true` |
| `state.manifest_dir` | `""`（空なら `~/Library/Application Support/WebTabinal/manifests`。変更はデーモン再起動後） |
| `confirm_close_running` | `true` |
| `copy_on_select` | `false` |
| `quit_when_no_tabs` | `true` |
| `close_tab_on_clean_exit` | `true`（Ctrl+D などでシェルが exit 0 のときタブを閉じる） |
| 新しいタブ | `Cmd+N`（またはサイドバーの ＋） |
| タブ切り替え | `Cmd+1` … `Cmd+9` |
| 隣のタブへ移動 | 既定はオフ。設定 → キーボードで有効化。既定の割り当ては `Ctrl+J` のあと `n`（次）/ `p`（前） |
| `key_bindings.enabled` | `false` |
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

通常のテストは fixture replay とデーモン/CLI の単体テストです。実エージェントを起動する検証は任意です。

```bash
go test -race ./...
cd web && node --test --experimental-strip-types tests/*.test.ts
make e2e-state AGENT=cursor-agent   # ローカルのみ。CI では実行しない
```
