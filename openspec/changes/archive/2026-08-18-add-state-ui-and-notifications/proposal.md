## Why

daemon が検知した agent state をユーザーが常時確認でき、`blocked` を見逃さないためには、状態を再接続可能な client protocol、sidebar 表示、既存通知 policy へ一貫して接続する必要がある。OSC と画面検知が同じ待機を報告しても、通知が重複しない契約も必要である。

## What Changes

- session list snapshot に agent identity / state / since を含め、遷移時に全 client へ専用 WebSocket frame を push する
- sidebar tab に `working` / `blocked` / `idle` の state pill を追加し、`none` は非表示、既存 unread dot と shell command / state 表示は維持する
- state pill は `blocked > working > idle > none` の表示優先度を使う。daemon の authoritative tab order は自動変更しない
- `→ blocked` を既存 notification pipeline の `agent_blocked` event として扱い、`notification.always` を適用し、`notification.min_duration_ms` の対象外にする
- OSC と screen detection の同一待機通知を session 単位の dedupe window で 1 回にまとめる
- `state.enabled`、debounce / quiescence / bottom-lines defaults、blocked notification、manifest directory の設定値を config API と Settings > Notifications に追加する
- protocol、UI、notification policy、config migration のテストと README の挙動表を更新する

## Capabilities

### New Capabilities

- （なし）

### Modified Capabilities

- `transport-api`: agent state の初期 snapshot とリアルタイム WebSocket push を追加する
- `terminal-ui`: sidebar tab に agent state pill と状態別の accessible presentation を追加する
- `notifications`: `blocked` 遷移通知、既存 suppression policy、OSC / screen 間 dedupe を定義する
- `daemon-core`: backward-compatible な `state` config defaults と validation を追加する
- `settings-ui`: agent state detection と blocked notification の設定 controls を追加する

## Impact

- Go daemon: `internal/server` WebSocket / REST serialization、`internal/config`、agent-state event wiring、notification dedupe
- Web UI: shared types、WebSocket reducer、sidebar components / styles、notification dispatch、settings UI
- Documentation: README の notification / agent support / settings 表
- Compatibility: 既存 session `state` frame と OSC `notify` frame は維持し、新規 agent-state fields / frame を additive に追加する
- Dependency: `add-agent-state-engine` が提供する state store と event subscription が先に必要
