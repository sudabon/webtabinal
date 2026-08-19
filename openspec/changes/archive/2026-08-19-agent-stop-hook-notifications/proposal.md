## Why

画面検知による `working` → `idle` のプロンプト復帰通知が頻繁すぎる。検知は画面の静止（quiescence）に依存するため、エージェントが思考のために出力を止めただけでも `idle` に落ちて通知が出る。ターンが本当に終わったかどうかを、画面からは確実に判定できない。

一方で 3 つのエージェントはいずれもターン終了を自分で知っており、それを外部へ渡す口を持っている。推測をやめてエージェント自身の申告を使えば、通知は「ターンが終わったときだけ」正確に出せる。

調査で分かった各エージェントの実情は次のとおり。

| エージェント | ターン終了の口 | 端末への直接出力 | 確認方法 |
|---|---|---|---|
| Claude Code | `Stop` hook（`~/.claude/settings.json`） | 不可。hook は制御端末を持たない。代わりに JSON 出力の `terminalSequence` を Claude Code が端末へ書く（1000 文字上限、`Stop` は対応） | 公式ドキュメント |
| Codex | 追加不要。`[tui] notifications` と `notification_method = "osc9"` が `agent-turn-complete` で OSC 9 を出す | 可（Codex 本体が出力） | 公式ドキュメントと実機 config |
| cursor-agent | `stop` hook（`~/.cursor/hooks.json`） | **不可**。`/dev/tty` を開けない。stdout に返せるのは `followup_message` のみで `terminalSequence` 相当がない | 実機の PTY 実測 |

cursor-agent の `stop` hook は実機の対話セッションで発火を確認した。ペイロードは `{"status":"completed","loop_count":0,"session_id":"…","hook_event_name":"stop", …}`。**このとき hook プロセスは `WEBTABINAL_SESSION_ID` を継承していた。** 端末に書けなくても、セッション ID があれば loopback API 経由で daemon に届けられる。

なお現行 README が案内している Claude Code hook の `printf '\033]9;…' > /dev/tty` は、hook が制御端末を持たなくなったため**現在は動作しない**。

## What Changes

- `POST /api/sessions/{id}/notify` を追加する。既存のトークン認証と Host/Origin 検査を通り、`title` / `body` / 任意の `kind` を受け取って既存の `notify` フレームを broadcast する
- `webtabinal notify` CLI サブコマンドを追加する。`WEBTABINAL_SESSION_ID` を既定のセッション ID として使い、config.json から認証トークンを読み、上記エンドポイントを叩く。daemon が起動していなければ起動せず、静かに終了する
- 3 エージェント分の hook 設定を README に載せる。cursor-agent は `~/.cursor/hooks.json` の `stop`、Claude Code は `Stop` hook、Codex は hook 不要で `[tui]` 設定のみ
- README の Claude Code hook 記述を `/dev/tty` から `terminalSequence` に差し替える
- 画面検知によるプロンプト復帰通知に `state.notify_on_idle` を追加し、**既定を false にする**。hook を入れたエージェントでは不要で、入れていないエージェント向けに残す
- `webtabinal hooks print <agent>` を追加する。貼り付け可能な hook 設定断片を標準出力に出す。設定ファイルの自動書き換えはしない

**BREAKING**: 画面検知のプロンプト復帰通知が既定でオフになる。hook を設定していないユーザーは `state.notify_on_idle` を true にするか hook を入れる必要がある。README に移行手順を書く。

## Capabilities

### New Capabilities

- （なし）

### Modified Capabilities

- `notifications`: hook 由来のターン終了通知と、画面検知プロンプト復帰通知の既定オフを定義する
- `transport-api`: セッション通知エンドポイントを追加する
- `daemon-core`: `state.notify_on_idle` の既定値とバリデーション、`webtabinal notify` / `webtabinal hooks print` CLI を追加する

## Impact

- Go daemon: `internal/server`（新エンドポイントとルーティング）、`internal/config`（`state.notify_on_idle`）、`internal/server/ws.go`（プロンプト復帰通知の条件）
- CLI: `cmd/webtabinal`（`notify` と `hooks print`。既存の `state snapshot` と同じく daemon を起動しない）
- Web UI: 「設定 → 通知」に画面検知プロンプト復帰通知のトグルを追加する
- Documentation: README の通知セクション、エージェント別設定、設定表
- 依存: `scope-agent-notifications` が入れた `notification.commands` と `kind=agent_idle` を前提にする
- スコープ外: hook 設定ファイルの自動書き換え。`~/.claude/settings.json` や `~/.cursor/hooks.json` は他ツールと共有される設定で、Codex の `notify` スロットのように既に別用途で埋まっていることがある。断片の提示までに留める
