## Why

WebTabinal の daemon は現在 PTY のバイト列を転送・保存するだけで、クライアントが閉じている間に「いま画面に何が表示されているか」を判断できない。エージェント状態検知を daemon 側で成立させるため、検知ルールから独立したヘッドレス VT 画面モデルを先に導入する必要がある。

## What Changes

- Go の VT エミュレータ候補を実データで比較し、alt screen、CJK 幅、リサイズ、スクロールリージョンを満たす実装を選定する
- 各 live session に primary / alternate buffer を持つヘッドレス画面モデルを追加し、PTY 出力を既存のリングバッファ・WebSocket 転送と同じ読み取り点から tee する
- アクティブバッファの下端 K 行をテキストとして取得できる snapshot API を追加する
- PTY リサイズを画面モデルへ反映し、並行する出力・resize・snapshot を race なく扱う
- alt screen、CJK、resize、スクロールリージョンの fixture test と、メモリ・大出力時の性能計測を追加する
- エージェント同定、状態判定、通知、UI はこの change に含めない

## Capabilities

### New Capabilities

- `vt-screen-model`: daemon がセッションごとの terminal screen を再構築し、アクティブバッファの下端行を安全に snapshot する契約

### Modified Capabilities

- （なし）

## Impact

- Go daemon: 新規 `internal/vtscreen` package（名称は実装時に確定）、`internal/session` の PTY output / resize lifecycle
- Dependencies: 選定した Go VT emulator library と、その transitive dependencies
- Tests: raw VT fixture、race test、benchmark / memory measurement
- Compatibility: PTY output、ring buffer replay、既存 WebSocket payload は変更しない
- Dependency: 後続の `add-agent-state-engine` は本 capability を利用する
