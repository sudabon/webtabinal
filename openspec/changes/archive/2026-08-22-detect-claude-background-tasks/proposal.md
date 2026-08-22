## Why

Claude Code がバックグラウンドタスクを実行している間も画面下端には入力プロンプトが残るため、screen detection は `idle` パターン (`^\s*(❯|>)\s*$`) に一致し、agent state が `idle` に落ちる。実際には処理が継続しているのに、サイドバーの state pill は「待機中」を示すため、利用者はセッションの実態を誤認する。

Claude Code の TUI はバックグラウンド実行中であることを示す行を画面下端に描画している。この行を `working` パターンとして拾えば、既存の優先順位（`blocked` → OSC → `working` → `idle`）がそのまま働き、Go 側のロジックを変えずに `idle` への誤判定を防げる。

## What Changes

- `claude` manifest の `screen.states.working` に、採取したバックグラウンド実行中表示を捉えるパターンを追加する
- 採取した実文字列は `✻ Churned for 30m 19s · 2 shells still running`。行の意味は「ターン完了後もバックグラウンド作業が残っている」であり、ターン完了だけの行（`✻ Churned for 30m 19s`、`still running` なし）とは区別する
- 変動部分（動詞 `Churned`、経過時間 `30m 19s`、件数 `2`、対象名詞 `shells`）は正規表現で吸収する。アンカーは行頭の `✻` と不変の `still running` とする
- 採取した画面を versioned fixture として `tests/fixtures/agents/claude/` 配下に追加し、既存の golden test harness で「バックグラウンド実行中は `working` を維持し、完了後に `idle` へ落ちる」ことを回帰テストする
- `claude` manifest の `verified_against` に、パターンを確定した Claude Code のバージョンを記録する
- 検知対象は `claude` manifest のみとする。Codex / cursor-agent は表示形式が異なり未調査のため、本 change のスコープ外とする

## Capabilities

### New Capabilities

（なし）

### Modified Capabilities

- `agent-state-detection`: Claude Code のバックグラウンドタスク実行中に、入力プロンプトが同時に描画されていても agent state を `working` に維持することを要求に加える

## Impact

- Embedded assets: `internal/agentdetect/manifests/claude.json`（`screen.states.working` と `verified_against`）
- Tests: `tests/fixtures/agents/claude/` への fixture 追加と、`internal/agentdetect` の golden / replay テスト
- 通知への影響: 画面由来の prompt-return 通知（`state.notify_on_idle`、既定で無効）は、バックグラウンドタスク完了まで遅延する。これは意図した挙動である。stop hook 由来のターン完了通知は画面状態に依存しないためターン終了時に従来どおり発火し、`blocked` 由来の承認待ち通知は `working` より優先評価されるため影響を受けない
- Go / React のコード変更、WS プロトコル、設定項目の追加はいずれも不要
- Compatibility: manifest はローカル上書き（`state.manifest_dir`）が可能なため、パターンが将来失効しても利用者側で先行して修正できる
