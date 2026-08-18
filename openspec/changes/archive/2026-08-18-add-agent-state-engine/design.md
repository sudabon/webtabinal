## Context

WebTabinal には shell command lifecycle の `starting / idle / running / exited` と OSC 9 / 99 notification event があるが、これは agent の turn state ではない。`add-vt-screen-model` が提供する daemon-side snapshot を入力に、agent identity と `none / idle / working / blocked` を別の state domain として保持する必要がある。

検知対象の TUI 文言・layout は version で変わり、すべての signal が常に利用できるわけではない。誤った `blocked` は notification spam を生むため、engine は manifest ごとに各 state を書ける signal を制限し、未知形状を safe な `idle` に倒す。状態は観測・通知用であり、PTY input の自動送信へ接続してはならない。

## Goals / Non-Goals

**Goals:**

- session ごとの agent identity と current state を daemon 内で継続的に導出・保持する
- screen、activity、OSC、shell command、foreground process を明示的な authority rules で統合する
- Claude Code、Codex、generic TUI を versioned manifest で扱い、local override を安全に読み込む
- blocked の低 latency、working-to-idle hysteresis、未知画面の fail-safe を決定的にテストする
- current snapshot と transition subscription を後続の transport / notification integration へ提供する

**Non-Goals:**

- WebSocket payload、sidebar UI、desktop notification、settings controls
- Cursor Agent 専用 manifest と一般利用向け fixture recording tooling
- remote manifest download / update、manifest hot reload、state history persistence
- state に基づく PTY input、自動承認、自動応答、agent process control

## Decisions

### 1. Shell state と agent state を別 model として保持する

`internal/agentdetect` は `AgentState` (`none | idle | working | blocked`) と immutable `Snapshot`（session ID、agent ID、state、since、signal、detail）を所有する。既存 `session.State` は shell command completion、close confirmation、elapsed time のため変更しない。たとえば shell state が `running` の間に agent state は `working` と `blocked` を往復できる。

engine は `Snapshot(sessionID)` と subscribe / unsubscribe seam を公開する。callback は engine lock の外で呼び、state または identity が実際に変わった時だけ event を出す。`since` は現在 state に入った時刻で、同じ判定の再評価では更新しない。v1 は current snapshot のみを保持し、transition history は保持しない。

### 2. Input adapter と per-session detector を分離する

manager-level engine が detector lifecycle と subscribers を管理し、各 live session に一つの detector を割り当てる。detector は次の typed input を受ける。

- output chunk metadata（timestamp、byte count）と、debounce 後に取得する VT snapshot
- parsed OSC 9 / 99 / 777 event
- shell integration の command-start / command-end / prompt と command line
- periodic foreground process observation
- terminal resize / model unavailable notification

clock、screen snapshot provider、process inspector、scheduler を interface 化し、tests は wall clock、実 PTY、実 process table に依存しない。session close で pending timer を cancel し、最終 state を破棄する。

### 3. Identity は command signal を一次、foreground process を補完にする

shell integration の command-start で command pattern が一致した場合、その専用 manifest を provisional identity とする。foreground process executable（必要なら process ancestry）が一致すれば確認し、integration がない session では foreground process match だけでも identity を決定する。command-end / prompt 後に matching foreground process がなくなれば `none` へ戻す。

専用 manifest がない foreground TUI、または alternate screen を使う non-shell foreground process は `generic` を使う。複数 manifest が一致した場合は exact executable、command pattern、generic の順で deterministic に選び、同順位は manifest ID の安定順とする。過去の command string だけで agent identity を永久に保持する案は、agent 終了後も state pill が残るため採用しない。

process inspection は既存 `TIOCGPGRP` seam を再利用し、platform-specific executable resolution を小さな interface の背後に置く。inspection failure は screen-only / generic fallback とし、session 動作を失敗させない。

### 4. Manifest は厳格に validate し、local file を ID 単位で優先する

schema version 1 は ID / display name、executable / command match、screen buffer と bottom lines、state regex、authority、OSC authority、quiescence、activity window / minimum bytes、verified versions を表す。JSON decode は unknown field、unsupported schema、invalid enum、missing authority、invalid / empty regex、範囲外 duration を reject し、regex は load 時に一度だけ compile する。

bundled `claude`、`codex`、`generic` を `go:embed` で読み、設定された manifest directory（既定は Application Support の `manifests`）に同じ ID があれば file 全体を置き換える。invalid local override は同 ID の bundled manifest へ黙って fallback せず、その manifest を unavailable として error を明示し、detector は generic / idle-safe に倒す。これにより typo を隠さず「local override always wins」を維持する。

v1 の load は daemon 起動時の atomic registry 構築に限定する。fsnotify hot reload は partial write、in-flight detector migration、session safety の設計を増やすため defer する。manifest directory 変更と file 更新には daemon restart が必要であることを documentation と将来の settings UI に表示する。

### 5. State evaluation は authority と固定 priority に従う

output 後 120 ms の trailing debounce で screen を評価する。連続 output 中は activity signal が `working` を維持し、出力が止まった approval / prompt screen は最後の chunk から 120 ms 後に評価される。すべての timestamp は injected monotonic clock で比較する。

評価順序は次のとおりとする。

1. identity がない場合は `none`
2. authorized blocked screen pattern が一致すれば quiescence を待たず `blocked`
3. authorized working screen pattern、または configured activity window / minimum byte rate を満たせば `working`
4. authorized idle screen patternか未知 screen で、output が quiescence threshold を超えて静止していれば `idle`
5. `osc_authoritative` manifest の completion OSC は idle 遷移を前倒しする。ただし後続 output は再び working にできる

blocked pattern が消えた時は latch せず同じ規則で working / idle を再計算する。`working → idle` は screen idle / unknown と quiescence の両方を要求する。generic は activity が閾値内なら working、静止後は idle とし、authority validation により blocked を生成できない。initial defaults は debounce 120 ms、quiescence 1500 ms、activity window 1000 ms、minimum 32 bytes/window とし、manifest options で agent ごとに調整できる。

### 6. Pattern match は画面下端の text と pattern identity だけを扱う

detector は manifest の buffer selector と bottom-lines を VT snapshot request に使い、行単位の precompiled regex を評価する。CJK column width へ依存しないよう column coordinate や absolute cursor position は condition に含めない。state priority 内では manifest 記載順の最初の match を採用する。

event の `detail` は pattern ID / index のような診断 metadata に限定し、captured screen text 全体を保存しない。screen model が unavailable の場合は process / activity / OSC の許可された signal だけを用い、根拠がなければ identified agent を idle-safe にする。

### 7. Roll-up は pure priority function として先に定義する

現在は tab と session が 1:1 だが、複数 child state の roll-up helper を `blocked > working > idle > none` として pure function で実装・test する。空集合は `none`。engine の session state 自体には不要な pane / workspace model を追加しない。

### 8. Safety boundary を package API で強制する

agent detector が受け取る session seam は read-only snapshot と observations のみとし、`Write`, PTY fd、input callback を渡さない。manifest schema に action / response field を設けない。将来 consumer が state event を購読しても、この package から terminal input を送ることはできない構造にする。

## Risks / Trade-offs

- [agent update で pattern が失効する] → versioned fixtures、`verified_against`、local override、unknown-to-idle fallback を使う
- [blocked false positive が notification spam を起こす] → blocked は screen-only の高確度 pattern と明示 authority に限定し、generic では禁止する
- [output spinner や cursor redraw が working を長引かせる] → activity window / byte threshold を manifest 化し、fixture の fake clock で調整する
- [foreground executable resolution が wrapper / pipeline で曖昧] → command signal を一次とし、process ancestry と generic fallback を使う
- [invalid override で専用検知が消える] → startup error を明示し、unsafe な bundled fallback より generic / idle-safe を選ぶ
- [timer / callback race が close 後 event を出す] → detector generation と cancellation を lifecycle に結び、race tests を置く

## Migration Plan

1. State / signal / manifest types、strict loader、embedded registry を実装する
2. Fake clock と fixture snapshot を使って authority、hysteresis、fail-safe、roll-up を実装・test する
3. session output / OSC / shell lifecycle と foreground inspector を adapters 経由で接続する
4. current snapshot と internal subscription を公開し、close / restart lifecycle と race tests を通す
5. Claude Code / Codex fixtures から patterns と `verified_against` を確定し、generic behavior を回帰 test する

wire protocol と config file はこの change では変更しない。rollback は engine wiring を外せば既存 shell state、OSC notifications、PTY sessions に戻る。

## Open Questions

- Claude Code / Codex の exact pattern と activity threshold は実 fixture 採取時に確定し、manifest の `verified_against` と test data に記録する。schema と safety rules はその値に依存しない。
