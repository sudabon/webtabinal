## Why

デスクトップ通知が agent 以外のプロセスでも鳴っている。OSC 9 / 99 / 777 の待機通知は agent 判定と無関係に配送されるため、OSC を吐くだけのビルドツールや `OSC 9;4` 進捗シーケンスでもバナーが出る。

一方で本来必ず欲しい通知が抜けている。coding agent がターンを終えてプロンプトを返した瞬間（`working` → `idle`）には通知経路が存在せず、通知は `blocked` 遷移と OSC 到着だけに依存している。`cursor-agent` は OSC 9/99/777 を出さないため、作業完了を知る手段が事実上ない。

## What Changes

- `state.notify_agents` 設定を追加する。既定値は `["claude", "codex", "cursor-agent"]`。値は manifest ID（= agent の起動コマンド名）
- agent-attention 通知（OSC 待機通知と `blocked` 遷移通知）を、そのセッションで検知されている agent が許可リストに含まれるときだけバナー配送する
- `working` → `idle` 遷移を新しい agent-attention イベント `kind=agent_idle` として通知する。これが「プロンプトが戻った」通知にあたる。`none` → `idle`（セッション開始直後の idle-safe）と `blocked` → `idle`（ユーザーが応答した直後）は通知しない
- 抑制されたイベントも `notify` フレーム自体は配送し、新しい `banner: false` フィールドでバナーだけを抑止する。未読ドットと Dock バッジは従来どおり付く
- `OSC 9;4;…`（ConEmu 進捗）と `OSC 9;9;…`（ConEmu cwd）を通知イベントとして解釈するのをやめる。これらは待機通知ではない
- `state.enabled=false` のときは許可リストを適用しない。既存要件「状態検出をオフにしても OSC 通知は残る」を維持する
- README の通知セクションと設定表を更新する

**BREAKING**: なし。既存 config は `applyDefaults()` で `notify_agents` 既定値が補われる。`notify` フレームへの追加は additive で、古い client は `banner` を無視して従来どおり動作する。

## Capabilities

### New Capabilities

- （なし）

### Modified Capabilities

- `notifications`: agent-attention 通知の許可リスト制限、`working` → `idle` のプロンプト復帰通知、バナー抑制と未読マークの分離を定義する
- `transport-api`: `notify` フレームに `kind=agent_idle` と `banner` を additive に追加し、OSC 9 サブコマンドの除外を反映する
- `daemon-core`: `state.notify_agents` の既定値・マイグレーション・バリデーションを追加する

## Impact

- Go daemon: `internal/config`（`StateConfig.NotifyAgents`、`applyDefaults`、`validateState`）、`internal/server/ws.go`（`broadcastNotify` / `onAgentSnapshot` の許可判定と `agent_idle` 経路）、`internal/osc/parser.go`（OSC 9 サブコマンド除外）
- Web UI: `web/src/types.ts` の `StateConfig` と `ServerMsg.notify`、`web/src/App.tsx` の `notifyAgentWait`（`banner=false` なら未読マークのみ）
- Documentation: README の通知セクション（115〜121行付近）と設定表（254行付近）
- 設定 UI は変更しない。`state.notify_agents` は `debounce_ms` や `manifest_dir` と同じく config.json 直編集で扱う
- 既知のリスク: `cursor-agent` の `working` は activity 由来のみのため、静かに思考する時間が `quiescence_ms` を超えると誤って `idle` 通知が出うる。design.md で対処方針を記す
