## Why

WebTabinal のデスクトップ通知はコマンド完了（`OSC 133;D` / running→idle）だけを拾う。Claude Code / Codex / cursor-agent は承認・質問・sudo で **プロセス実行中のまま** 止まるため、完了通知ではユーザ待ちに気づけない。3ツールとも OSC 9 / OSC 99 で待ちを出せるので、PTY から拾って既存の macOS 通知に載せる。

## What Changes

- PTY 出力から OSC 9（iTerm2 Growl）と OSC 99（Kitty desktop notification）をパースする
- 待ち通知を WebSocket のエフェメラル `notify` フレームで全クライアントへ送る（セッション state は `running` のまま）
- フロントは既存の Notification API でバナーを出し、非アクティブタブは未読ドットと Dock badge を付ける
- 抑制は完了通知と同じ（アクティブかつフォーカス時は出さない、`notification.always` で上書き）。`min_duration_ms` は待ち通知には適用しない
- 設定キーは増やさず `notification.enabled` で完了通知と待ち通知を両方制御する
- README に Claude Code / Codex / cursor-agent が OSC を出す最短設定を書く

## Capabilities

### New Capabilities

- （なし）

### Modified Capabilities

- `shell-integration`: OSC 9 と OSC 99 をパースし、シーケンスは xterm に素通しする
- `notifications`: エージェント待ち（OSC 由来）でも macOS 通知と未読マークを出す。完了通知の `min_duration_ms` は適用しない
- `transport-api`: エフェメラルな WS `notify`（`sid` + `title` + `body`）を追加する。`state` には載せない

## Impact

- Backend: `internal/osc` パーサ、`internal/server` の WS broadcast
- Frontend: `App.tsx` の通知経路、`types.ts` の ServerMsg
- Docs: README の通知とエージェント OSC 有効化
- 既存のコマンド完了通知・badge・設定スキーマは維持する
