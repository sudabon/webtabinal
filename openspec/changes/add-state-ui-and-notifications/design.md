## Context

`add-agent-state-engine` は daemon 内に current agent snapshot と transition subscription を提供するが、現行 client contract が扱う `state` は shell の `starting / idle / running / exited` だけである。WebSocket は compact な `t` / `sid` field を使い、initial `sessions` list と unattached session 向けの `state` broadcast を持つ。通知は daemon の OSC event を `t: "notify"` frame に変換し、React 側が enabled / always / duration policy と native / Web provider を適用する。

この change は agent state を additive に transport / UI へ接続し、screen-derived blocked transition を既存 notification policy へ流す。browser を閉じても daemon と sessions が残るため、live event だけでなく reconnect snapshot が authoritative でなければならない。既存 client、shell state、tab order、OSC notification behavior を壊さないことが制約である。

## Goals / Non-Goals

**Goals:**

- reconnect 直後を含め、全 session の agent identity / state を client が復元できる protocol を追加する
- shell state と agent state を同時に読み取れる accessible sidebar presentation を提供する
- screen-derived `blocked` を既存 notification / unread policy で通知し、OSC と重複させない
- backward-compatible な `state` config defaults、validation、settings controls を追加する
- disabled / reconnect / multi-signal / reduced-motion cases を自動 test する

**Non-Goals:**

- agent state による PTY input、承認 action、automatic tab selection
- daemon-authoritative tab order の変更または blocked tab の自動 sort
- state history / timeline UI、screen match detail の通常 UI 表示
- remote manifest updates または local manifest hot reload

## Decisions

### 1. Existing wire convention に additive agent-state frame を追加する

initial `sessions` item に次の optional-compatible fields を追加する。

- `agent`: manifest ID。未検出時は空 string
- `agent_state`: `none | idle | working | blocked`
- `agent_state_since`: RFC 3339 timestamp
- `agent_state_signal`: `screen | activity | osc | command | process | fallback`
- `agent_state_detail`: pattern ID などの optional diagnostic metadata

live transition は `{"t":"agent_state","sid":"...", ...same agent fields...}` として、attach 状態に関係なく全 clients へ送る。計画書の conceptual `type / session_id` frame をそのまま混在させず、既存 protocol の `t / sid` convention に合わせる。既存 `t: "state"` は shell state 専用のまま変更しない。

client connect 時は Hub の send queue 上で initial `sessions` snapshot を先に enqueue し、その後に届く transition event を順序どおり enqueue する。client reducer は sessions snapshot で全値を置換し、`agent_state` frame で対象 session だけ更新する。unknown frame / extra field を無視する既存 compatibility を維持する。

`detail` は matched text そのものではなく manifest pattern ID / index に限定する。通常 UI では使用せず、開発者診断だけに渡す。

### 2. Agent pill は shell status と unread indicator に併設する

sidebar tab の既存 3 rows と authoritative order は維持し、top row の unread dot 付近に agent pill を置く。`none` は DOM を描画せず、`idle` は muted neutral、`working` は spinner + text、`blocked` は attention color + text とする。色だけに依存せず accessible name に agent display name と state を含める。

working spinner は transform / opacity のみを animation し、`prefers-reduced-motion: reduce` では静止 glyph にする。blocked は自動点滅させない。pill click は action を持たず、tab select / drag / double-click / context menu behavior を妨げない。

agent state は shell state row を置き換えない。たとえば shell `running` と agent `blocked` を同時に表示する。unread dot は従来どおり tab activation まで残り、blocked state が解除されても勝手に clear しない。blocked tab を上へ自動 sort する案は daemon order、drag reorder、Cmd+number mapping を不安定にするため v1 では採用しない。

### 3. Blocked transition は daemon で notification event に変換する

agent engine の non-blocked → blocked transition を notification arbiter へ渡す。`state.notify_on_blocked` が true の場合、arbiter は既存 `notify` frame に `kind: "agent_blocked"` と `source: "screen"` を additive field として付ける。title / body は agent display name と session context から生成し、screen contents は含めない。client はこの frame を既存 agent-wait pathへ流すため、unread mark、platform provider、permission handling を再利用できる。

agent-state frame 自体から client が通知を生成する案は、reconnect snapshot や複数 reducer で duplicate を作りやすいため採用しない。通知は明示的な ephemeral `notify` frame だけを起点にする。

`notification.always` の foreground suppression semantics は既存のまま適用する。agent wait と同様に command duration を持たないため `notification.min_duration_ms` は適用しない。`state.notify_on_blocked=false` は screen-derived blocked notification だけを止め、pill と既存 OSC notifications は維持する。

### 4. OSC と screen の attention event は 4 秒 window で first-wins dedupe する

daemon arbiter は session ごとに最後に emission した agent-attention event の monotonic timestamp を保持する。OSC 9 / 99 / 777 wait event と screen-derived blocked event を同じ class とし、4 秒以内の後続 event は WebSocket notification emission だけを suppress する。agent state transition、pill update、既に付いた unread markは suppress しない。

first event を遅延させて source を集約する案は notification latency を増やすため採用しない。4 秒後、または別 session の event は通知できる。session close で dedupe entry を削除する。wall clock jump の影響を避けるため monotonic clock を使い、tests では fake clock を注入する。

### 5. `state` config group は safe defaults で migration する

config に次を追加する。

```json
{
  "state": {
    "enabled": true,
    "debounce_ms": 120,
    "quiescence_ms": 1500,
    "bottom_lines": 15,
    "notify_on_blocked": true,
    "manifest_dir": ""
  }
}
```

empty `manifest_dir` は Application Support の default directory を意味する。debounce は 20–5000 ms、quiescence は 0–60000 ms、bottom lines は 1–200、non-empty manifest directory は absolute path として validate する。manifest-specific quiescence / bottom-lines が global default より優先する。

既存 config は pre-populated defaults へ JSON unmarshal する現在の migration pattern で group 全体と missing fields を補う。patch validation failure は file と runtime engine の双方を変更しない。

`enabled`、debounce、quiescence、bottom-lines、notify flag は accepted patch 後に engine / arbiter へ atomic に反映する。disable 時は pending evaluations を cancel し、live sessions を `none` として broadcastする。re-enable 時は全 live sessions を即時再評価する。manifest registry は `add-agent-state-engine` の起動時 load policy を維持するため、`manifest_dir` 変更には daemon restart が必要である。

### 6. Settings > Notifications に basic と advanced controls を置く

Notifications category に state detection enabled と notify-on-blocked を primary controls として追加し、debounce、quiescence、bottom lines、manifest directory を collapsible advanced section に置く。値は既存 config patch flow で即時保存し、failure 時は last confirmed value へ rollback して visible error を示す。

state detection が disabled の間は dependent controls を disabled presentation にするが値は保持する。manifest directory control は「daemon restart required」を常時明記する。numeric constraints と manifest override priority を help text に表示する。

### 7. Tests は snapshot、ordering、policy を境界ごとに固定する

Go tests は session serialization、unattached broadcast、connect/transition ordering、config default/validation/migration、disable/re-enable、4-second dedupe、OSC-only compatibility を cover する。Frontend tests は reducer、initial snapshot、pill states、unread coexistence、drag/order preservation、accessibility、reduced motion、settings persistence / rollback を cover する。

existing notify provider tests を再利用し、screen-derived blocked が native / Web provider のどちらでも exactly once であること、permission がなくても unread state が残ることを確認する。

## Risks / Trade-offs

- [agent state と shell state の `state` 名が混同される] → wire / TypeScript で `agent_state` を一貫して使い、既存 `state` frame を変更しない
- [OSC と screen の arrival order が不定] → daemon-side monotonic first-wins dedupe と deterministic fake-clock tests を使う
- [古い client が新 fields を知らない] → existing payload への optional additive fields と独立 frame を使い、旧 frames を維持する
- [screen detail が terminal secrets を漏らす] → raw matched text を transport せず pattern identity のみに限定する
- [blocked auto-sort が keyboard order を壊す] → v1 は visual emphasis のみで authoritative order を維持する
- [runtime disable で stale pill が残る] → all live sessions に explicit `none` transition を broadcast する

## Migration Plan

1. State config model、defaults、validation、runtime reconfigure seam を追加する
2. Session serialization と `agent_state` WebSocket event を追加し、reconnect / ordering tests を通す
3. Notification arbiter と blocked-to-notify wiring、4-second dedupe を追加する
4. TypeScript model / reducer、sidebar pill、styles、settings controls を追加する
5. Go / frontend / desktop notification regressions と README behavior table を更新・検証する

すべて additive なため data migration は不要である。rollback 時は UI と transport wiring を外し、state config の unknown fields は旧 binary が無視または保持できる。agent engine と existing OSC notification path は独立して残せる。

## Open Questions

- なし。tab auto-sort と manifest hot reload は明示的に v1 scope 外とする。
