# PR #5 修正差分レビュー候補（iteration 1）

## Page 1

### R1-01
- file:line: desktop/Sources/DesktopSupport.swift:30
- 観点: correctness / compatibility
- 懸念: Foundation が JSON boolean を `Int` に bridge するため、`{"port":true}` を port 1 として受理する
- なぜ怪しいか: 初回指摘は非整数 port を拒否する要件だが、`JSONSerialization` の `__NSCFBoolean` は `as? Int` に成功する。
- 確信度: 高
- 出典: fix-diff review / type-design

### R1-02
- file:line: desktop/Sources/DesktopSupport.swift:100
- 観点: correctness / security
- 懸念: raw socket への `send` が、接続直後に peer が切断した場合の `SIGPIPE` を抑止していない
- なぜ怪しいか: Darwin の socket は既定で broken pipe 書き込み時に process-level signal を発生でき、無関係なローカルサービスの挙動で desktop app が終了し得る。
- 確信度: 高
- 出典: fix-diff review / correctness

### R1-03
- file:line: desktop/Sources/DesktopSupport.swift:130
- 観点: robustness
- 懸念: log file descriptor が 0、1、2 のいずれかになった場合、spawn file actions が同じ descriptor を上書きまたは close し得る
- なぜ怪しいか: 呼び出し元の標準 descriptor が閉じている特殊環境では `open` が低い番号を返し、stdin open / dup2 / close の順序がログ接続を壊す。
- 確信度: 中
- 出典: fix-diff review / correctness

### R1-04
- file:line: desktop/Sources/DesktopSupport.swift:64
- 観点: performance
- 懸念: HTTP identity probe が main thread 上で最大 300ms blocking する
- なぜ怪しいか: 応答しない peer が設定 port を保持すると、startup timer callback が同期 `recv` で繰り返し待つ。
- 確信度: 中
- 出典: fix-diff review / performance

### R1-05
- file:line: desktop/Tests/main.swift:51
- 観点: test coverage
- 懸念: Swift 側は response parser のみをテストし、socket request/response の統合を検証していない
- なぜ怪しいか: request format、send/recv、timeout、signal handling の退行は parser unit test では検出できない。
- 確信度: 中
- 出典: fix-diff review / test-coverage

<!-- 列挙完了: 合計5件 -->
