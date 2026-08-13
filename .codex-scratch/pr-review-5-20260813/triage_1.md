# PR #5 修正差分の精査分類（iteration 1）

## Must Fix

### R1-01 [Must Fix]
- file:line: desktop/Sources/DesktopSupport.swift:30
- 指摘: JSON boolean port が整数として受理され、初回の config 互換修正が非整数値を完全には拒否できていない。
- 故障シナリオ: `config.json` に `{"port":true}` がある状態で app を開く → native app は port 1 を probe する一方、Go daemon は同じ config を整数として読めず、起動契約が分岐する。
- 根拠: 現 SDK 上で `JSONSerialization` の boolean に対する `as? Int` が `Optional(1)` になることを再現した。
- 反証: 通常の WebTabinal が boolean を保存することはないが、コードは非整数を invalid とする明示要件を持つ。
- 最小修正案: `CFBooleanGetTypeID` を用いて boolean bridge を除外してから既存の整数/range 検証を行い、回帰テストを追加する。
- 出典: fix-diff review / type-design

## Should Fix

### R1-02 [Should Fix]
- file:line: desktop/Sources/DesktopSupport.swift:100
- 指摘: WebTabinal identity probe の raw socket write が `SIGPIPE` を抑止していない。
- 故障シナリオ: port owner が connect 後、request write 前後に接続を reset する → `send` が process-level `SIGPIPE` を発生させ native app を終了させ得る。
- 根拠: 変更前の probe は connect だけだったが、修正差分で初めて raw `send` を追加した。Darwin は socket ごとの `SO_NOSIGPIPE` を提供する。
- 反証: 通常の WebTabinal は接続を維持し、起動直後の短い probe で発生する窓は小さい。
- 最小修正案: connect/send 前に `SO_NOSIGPIPE` を設定し、設定できない場合は安全に probe failure とする。
- 出典: fix-diff review / correctness

## Consider

### R1-03 [Consider]
- file:line: desktop/Sources/DesktopSupport.swift:130
- 指摘: 標準 descriptor が事前に閉じている特殊環境では log descriptor と file actions が衝突し得る。
- 故障シナリオ: 該当なし
- 根拠: `open` は最小の空き fd を返すため、0〜2 が閉じていれば現在の action 順序に alias が生じる。
- 反証: LaunchServices から起動する通常の app process では標準 descriptor が用意され、追加対応と安全な subprocess test は今回の最小修正を超える。
- 最小修正案: 必要なら log fd を 3 以上へ duplicate する helper と descriptor-isolation test を別途追加する。
- 出典: fix-diff review / correctness

### R1-05 [Consider]
- file:line: desktop/Tests/main.swift:51
- 指摘: Swift probe の parser 以外の socket 経路は統合テストされていない。
- 故障シナリオ: 該当なし
- 根拠: socket request/timeout は pure parser test では直接実行されない。
- 反証: Go 側の実 HTTP identity tests、Swift parser tests、実 app compile が相補的に主要契約を検証している。安定した local socket harness は追加規模が大きい。
- 最小修正案: probe 実装がさらに複雑化した場合に loopback integration test を追加する。
- 出典: fix-diff review / test-coverage

## False Positive / Weak

### R1-04 [False Positive / Weak]
- file:line: desktop/Sources/DesktopSupport.swift:64
- 指摘: identity probe が main thread を一時的に block する。
- 故障シナリオ: 該当なし
- 根拠: timeout は 300ms で同期実行される。
- 反証: probe は window 表示前の bounded startup sequence のみで、変更前も同期 connect を同じ thread で行っていた。非同期化は lifecycle complexity を増やす。
- 最小修正案: 修正不要。実測で startup responsiveness 問題が出た場合のみ非同期化する。
- 出典: fix-diff review / performance
