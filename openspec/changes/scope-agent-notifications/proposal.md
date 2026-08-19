## Why

デスクトップ通知が鳴りすぎる。`ls` のような一瞬で終わるコマンドでも完了通知が出るうえ、OSC 9 / 99 / 777 の待機通知は agent 判定と無関係に配送されるため、OSC を吐くだけのビルドツールや `OSC 9;4` 進捗シーケンスでもバナーが出る。

原因が経路ごとにばらばらで、利用者から見て「どういう状態になったら鳴るのか」が予測できないことが本質的な問題である。コマンド完了は `notification.min_duration_ms`、前面抑制は `notification.always`、`blocked` 通知は `state.notify_on_blocked` と、条件が3か所に散っている。

一方で本来必ず欲しい通知が抜けている。coding agent がターンを終えてプロンプトを返した瞬間（`working` → `idle`）には通知経路が存在せず、通知は `blocked` 遷移と OSC 到着だけに依存している。`cursor-agent` は OSC 9/99/777 を出さないため、作業完了を知る手段が事実上ない。

## What Changes

- `notification.commands` を追加する。通知を出すコマンドのホワイトリストで、既定値は `["claude", "codex", "cursor-agent", "agent"]`
- **すべてのデスクトップ通知**（コマンド完了 / OSC 待機 / `blocked` 遷移 / プロンプト復帰）を、セッションのコマンドがホワイトリストに一致するときだけ出す。一致しないコマンドはバナーを出さない
- 照合はコマンド行の先頭トークンの basename の完全一致。`make build` は `make`、`/usr/local/bin/claude --resume` は `claude` として扱う
- 空リストはフィルタ無効（従来どおり全通知）とする。すべて止めたい場合は `notification.enabled` を false にする
- 抑制されたイベントもタブの未読ドットと Dock バッジは従来どおり付ける
- `working` → `idle` 遷移を新しい通知イベント `kind=agent_idle` として通知する。これが「プロンプトが戻った」通知にあたる。`none` → `idle`（セッション開始直後の idle-safe）と `blocked` → `idle`（ユーザーが応答した直後）は通知しない
- `OSC 9;4;…`（ConEmu 進捗）と `OSC 9;9;…`（ConEmu cwd）を通知イベントとして解釈するのをやめる
- 設定 UI「設定 → 通知」にホワイトリストの編集欄を追加する。コマンドの追加・削除は日常的に発生するため、config.json 直編集（デーモン再起動が必要）では運用に耐えない
- README の通知セクションと設定表を更新する

**BREAKING**: 既定でホワイトリスト外のコマンドはバナーを出さなくなる。未読ドットは残るため取りこぼしは起きない。既存 config は `applyDefaults()` で `notification.commands` の既定値が補われる。

## Capabilities

### New Capabilities

- （なし）

### Modified Capabilities

- `notifications`: 全通知経路に対するコマンドホワイトリスト、`working` → `idle` のプロンプト復帰通知、ConEmu OSC 9 サブコマンドの除外を定義する
- `transport-api`: `notify` フレームに `kind=agent_idle` を additive に追加し、OSC 9 サブコマンドの除外を反映する
- `daemon-core`: `notification.commands` の既定値・マイグレーション・バリデーションを追加する
- `settings-ui`: 通知するコマンドの編集 control を追加する

## Impact

- Go daemon: `internal/config`（`NotificationConfig.Commands`、`applyDefaults`、`validate`）、`internal/server/ws.go`（`agent_idle` 経路）、`internal/osc/parser.go`（OSC 9 サブコマンド除外）
- Web UI: `web/src/notify.ts`（ホワイトリスト判定）、`web/src/App.tsx`（完了通知と待機通知の両方に適用）、`web/src/types.ts`、`web/src/components/NotificationsSettings.tsx`
- Documentation: README の通知セクションと設定表
- 判定はフロントエンドに置く。`notification.enabled` / `always` / `min_duration_ms` がすべてクライアント側ポリシーであり、コマンド完了通知はサーバから `notify` フレームが飛ばず `state` フレームから生成されるため、デーモン側に置くと同じルールが 2 箇所に分かれる
- 既知のリスク: `cursor-agent` の `working` は activity 由来のみのため、静かに思考する時間が `quiescence_ms` を超えると誤って `idle` 通知が出うる。design.md で対処方針を記す
