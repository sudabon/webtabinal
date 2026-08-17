## Why

既存の OSC 通知はエージェント側の設定と協力に依存するイベントであり、各タブの現在状態を継続的には表せない。daemon が画面・出力・shell / process 情報を統合し、エージェント非依存の `none / idle / working / blocked` 状態を安全側に導出できる基盤が必要である。

## What Changes

- セッションごとに agent identity、agent state、遷移時刻、根拠 signal を保持する状態エンジンを追加する
- 画面パターン、出力 activity、OSC 9 / 99 / 777、shell integration の command line、foreground process を signal authority に従って統合する
- `blocked` の即時遷移、`working → idle` の quiescence、未知画面を `idle` に倒すフェイルセーフ、`blocked > working > idle > none` の roll-up 規則を実装する
- schema version 付き JSON manifest loader を追加し、`claude`、`codex`、blocked を生成しない `generic` manifest を `go:embed` で同梱する
- Application Support 配下の local manifest override を bundled manifest より優先する。v1 では反映を daemon 起動時に限定し、hot reload は後続検討とする
- 状態遷移を購読できる内部 event API を追加するが、この change では WebSocket、UI、通知への接続は行わない
- fixture replay と状態機械の table / property test を追加し、状態を根拠に PTY input を送る API を設けない

## Capabilities

### New Capabilities

- `agent-state-detection`: manifest-driven なエージェント同定、signal authority、状態遷移、local override、内部状態購読の契約

### Modified Capabilities

- （なし）

## Impact

- Go daemon: 新規 `internal/agentdetect` package（名称は実装時に確定）、session lifecycle / output hooks、OSC event integration、foreground process inspection
- Embedded assets: versioned Claude Code / Codex / generic manifests
- Local files: `~/Library/Application Support/WebTabinal/manifests/*.json` を起動時に読み込む
- Tests: agent-state fixture replay、quiescence / authority / fail-safe / override tests
- Compatibility: 既存の shell `starting / idle / running / exited` state と OSC notification event は維持し、agent state を別フィールドとして扱う
- Dependency: `add-vt-screen-model` の snapshot capability が先に必要
