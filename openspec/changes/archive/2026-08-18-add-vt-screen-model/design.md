## Context

現在の session read loop は PTY から読んだ chunk を ring buffer に保存し、OSC parser へ渡してから WebSocket output callback へ転送する。daemon 自身は terminal の primary / alternate screen、cursor、cell width を保持しないため、browser が閉じている間の画面形状を取得できない。

後続の agent-state detector は画面下端の安定した text snapshot を必要とする。一方、この change は terminal emulation を状態判定から切り離し、既存の PTY byte stream、ring replay、OSC processing に影響を与えない独立基盤として導入する。PTY output は任意のローカル process が生成できるため、malformed escape sequence でも daemon や session forwarding を停止させないことが制約になる。

## Goals / Non-Goals

**Goals:**

- 各 live session の primary / alternate screen と active buffer を daemon memory 内で再構築する
- CJK wide character、resize、scroll region を含む実 terminal fixture から決定的な snapshot を返す
- PTY output、resize、snapshot の並行実行を race なく扱う
- downstream detector が emulator library 固有 API に依存しない小さな adapter contract を提供する
- 既存 output forwarding の byte identity と順序を維持し、性能・memory overhead を計測可能にする

**Non-Goals:**

- scrollback の再実装または ring buffer との統合
- xterm.js と全 escape sequence で pixel-perfect に一致する renderer
- agent identity、pattern matching、state transition、notification、WebSocket protocol の実装
- screen 内容の永続化、remote access、daemon restart をまたぐ復元

## Decisions

### 1. Emulator を `internal/vtscreen` adapter の背後に置く

`internal/vtscreen` は session が所有する `Screen` を提供し、外部へは概ね `Feed([]byte) error`、`Resize(cols, rows) error`、`Snapshot(options) Snapshot`、`Close()` のみを公開する。`Snapshot` は buffer kind、dimensions、top-to-bottom の lines、model availability を含み、raw emulator cell や mutable buffer を公開しない。

実装の最初に `charmbracelet/x/vt` と `hinshun/vt10x` を同じ conformance fixtures に通す。alt screen の識別 API、wide-cell handling、DECSTBM、resize、maintenance 状況を scorecard に記録し、すべての必須 fixture を満たす最小の dependency を採用する。library を先に固定する案は実 agent output との適合性が未確認であり、自前 parser は保守範囲が大きすぎるため採用しない。どちらも要件を満たさない場合のみ、adapter 内の不足部分を限定的に補う。

### 2. Screen feed は既存 read loop の同期 tee とする

PTY chunk は一度 copy した後、既存 ring / OSC / output callback と同じ read-loop goroutine から screen model に順番どおり feed する。screen update 完了後に output callback を呼ぶため、その chunk を契機にした detector は必ず更新済み snapshot を参照できる。rule evaluation 自体は後続 change の debounce worker で行い、read loop には置かない。

`Feed` は input slice を保持・変更しない。emulator が error または panic 相当の failure を起こした場合は、その session の model を unavailable にして rate-limited log を残し、ring write、OSC parse、client forwarding は継続する。別 goroutine に無制限 queue を置く案は PTY burst 時に memory と screen freshness が不定になるため採用しない。

### 3. Snapshot は visible grid の正規化済み copy を返す

buffer selector は `active`、`primary`、`alternate` を受け付け、通常は `active` を使う。bottom-lines が K の場合、選択 buffer の visible rows の末尾 `min(K, rows)` 行を top-to-bottom で返す。blank row も位置情報として残す。

各行は ANSI / OSC sequence を含まない Unicode text とし、wide glyph の continuation cell を重複出力せず、leading / interior spaces を保持し、trailing blank cells だけを除く。snapshot は lock 内で immutable copy を作ってから返すため、呼び出し側が pattern evaluation 中でも PTY ingestion を長時間 block しない。column-coordinate API は CJK width 差異に検知規則が依存するのを避けるため v1 では公開しない。

### 4. Resize の成功を PTY と model の共通 geometry とする

session の resize path は request を validation し、PTY winsize update が成功した場合に同じ cols / rows を screen model と session metadata へ適用する。model resize が失敗した場合は model を unavailable にするが、PTY resize 自体は rollback しない。snapshot の dimensions は model が実際に採用した値を返す。

既存 visible cells の扱いは採用 library の terminal semantics（preserve / clip）に従い、scrollback reflow は要求しない。resize 後の新しい output、active buffer、snapshot dimensions が一貫することを fixture と concurrent test で保証する。

### 5. Session lifecycle と model lifecycle を一致させる

screen model は PTY 作成時の cols / rows で生成し、その session の read loop が終了して close されるまで同じ instance を保持する。ring buffer からの backfill は行わない。model construction に失敗しても session 作成は成功させ、snapshot は unavailable を明示する。

testability のため session へ concrete emulator ではなく factory を注入できる seam を設ける。これにより feed ordering、failure isolation、resize、close を fake model で検証できる。

### 6. Conformance と budget を merge gate にする

fixture suite は primary text、DECSET / DECRST 1049、vim / less 相当の alternate screen、DECSTBM、cursor movement / erase、Japanese wide glyph、combining mark、resize を含める。race detector で feed / resize / snapshot の並行実行を検証する。

200x60 の primary + alternate buffer を持つ 1 session の追加常駐 memory を計測し、目安 1 MiB 未満を満たす。100 MiB の deterministic stream を screen model 有無で benchmark し、すべての input bytes が既存 sink に同じ順序で到達することと相対 overhead を記録する。特定 hardware の wall-clock 値を API contract にはしないが、著しい退行を review で検出できる baseline を残す。

## Risks / Trade-offs

- [選定 library が一部の agent 固有 sequence を扱えない] → adapter と raw fixture で差分を局所化し、unsupported case では model を unavailable / downstream idle-safe に倒す
- [同期 feed が高出力 session の latency を増やす] → rule evaluation を read loop 外へ置き、100 MiB benchmark を選定・merge gate にする
- [snapshot copy が output ingestion と競合する] → lock 内では visible rows の copy のみ行い、regex evaluation は lock 解放後に行う
- [CJK / combining cell の text 化が library ごとに異なる] → column anchor を公開せず、Unicode fixture で adapter output を固定する
- [malformed PTY bytes が daemon を不安定にする] → per-session failure isolation と fuzz / malformed-sequence tests を追加する

## Migration Plan

1. Adapter contract と conformance fixtures を追加し、候補 library の scorecard を確定する
2. 選定 library を adapter に実装し、standalone unit / race / benchmark tests を通す
3. session creation、read loop、resize、close に model lifecycle を接続する
4. existing Go tests と output/replay regression tests を実行し、memory / throughput baseline を記録する

永続 data や wire protocol の migration はない。rollback は session integration を外して dependency と package を削除すればよく、ring buffer や config file の変換は不要である。

## Open Questions

- 採用 library は conformance spike の結果で確定する。scorecard と選定理由を change 内に記録してから session integration を開始する。
