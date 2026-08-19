## Context

動機は proposal.md - Why を参照。既存実装の制約は次のとおり。

- 通知の起点は 2 つある。`Hub.broadcastNotify()` が OSC 由来、`Hub.onAgentSnapshot()` が `blocked` 遷移由来。どちらも `notifyarbiter.Arbiter`（session 単位・4 秒 first-wins）を通り、`t=notify` フレームとして全 client へ broadcast される
- `agentdetect.Registry.Resolve()` は ①実行ファイル名の完全一致（前景プロセスと**その祖先**）→ ②コマンド行の正規表現 → ③`isGenericTUI()` による `generic` フォールバックの順で manifest を選ぶ。シェル以外の前景プロセスや alternate buffer 利用はすべて `generic` になる
- `generic` は `blocked` を出せない（`evaluate.go` の `blockedEvidence()` が `IDGeneric` を早期 return）。つまり現状の騒がしさは OSC 経路が主因である
- `Detector.idleEvidence()` は quiescence を満たせば idle パターン未一致でも `idle` を返す（detail は `unknown-screen` / `idle-safe` / `screen-unavailable`）。パターン一致は idle の必要条件ではない
- `cursor-agent` manifest は `working` の authority が `activity` のみで、OSC 9/99/777 を出さない。`claude` / `codex` は `working` を `esc to interrupt` などの画面パターンで確定できる
- `Manager.AgentSnapshot(id)` で任意タイミングにセッションの `AgentID` を取得できる。`Hub` は `manager` を保持しているので参照可能

## Goals / Non-Goals

**Goals:**

- 通知の可否判定を Hub の 1 か所に集約し、OSC 経路・`blocked` 経路・新設の `agent_idle` 経路が同じ規則に従う
- `claude` / `codex` / `cursor-agent` がターンを終えた瞬間に、OSC を出すかどうかに関わらず通知が出る
- 未読ドットと Dock バッジの挙動を後退させない

**Non-Goals:**

- state pill と `agent_state` フレームの抑制。検知そのものは従来どおり `generic` を含めて動く
- 設定 UI の追加。`state.notify_agents` は config.json 直編集で扱う
- `Registry.Resolve()` の同定ロジック変更。祖先プロセス名照合による誤爆は別 change で扱う
- `notification.enabled` / `always` / focus 抑制など既存の client 側 policy の変更

## Decisions

### 判定を daemon 側の Hub に置き、frontend では判定しない

`Hub` に `notifyAllowed(sessionID string) bool` を 1 つ設け、`broadcastNotify()` と `onAgentSnapshot()` の両方から呼ぶ。判定順は次のとおり。

1. `cfg.State.Enabled == false` → `true`（既存要件「検出オフでも OSC 通知は残る」を維持）
2. `manager.AgentSnapshot(sid)` で `AgentID` を得る
3. `AgentID == ""` または `AgentID == agentdetect.IDGeneric` → `false`
4. `cfg.State.NotifyAgents` が空 → `true`
5. `AgentID` がリストに含まれる → `true`、含まれない → `false`

**代替案（不採用）**: frontend の `notifyAgentWait()` で判定する。`agent` は `SessionInfo` にあるので実装可能だが、判定に必要な設定と agent identity が daemon 側にあり、二重管理になる。また `state.enabled=false` の例外規則を両側で持つことになる。

### 許可リストの値は manifest ID にする

`state.notify_agents` は manifest ID の配列。バンドル manifest の ID（`claude` / `codex` / `cursor-agent`）は起動コマンド名と一致しているので、ユーザーから見れば「コマンド名で絞る」設定として読める。ローカル manifest を足せばそのまま拡張できる。

**代替案（不採用）**: セッションの前景コマンド名も併せて照合する。manifest を持たない自作 agent の OSC 通知を拾えるが、照合規則が 2 系統になり spec とテストが倍になる。今回名指しされた 3 つはいずれも manifest を持つので YAGNI とする。

### 空リストは「識別済み agent すべて」にする

3 値のセマンティクスを持たせる。

| `state.enabled` | `state.notify_agents` | バナー |
| --- | --- | --- |
| `false` | — | フィルタしない（従来どおり） |
| `true` | `["claude","codex","cursor-agent"]`（既定） | この 3 つのみ |
| `true` | `[]` | 識別済み agent すべて。`generic` と未識別は除外 |

空リストを「全許可（`generic` 含む）」にすると、値を消すほど通知が増えるという直感に反する挙動になる。またフィルタの完全解除は `state.enabled=false` が既に担っているので、専用のマジック値を足す必要がない。

Go では JSON の欠落フィールドは `nil`、`[]` は非 nil の空 slice になるため、`applyDefaults()` で `if cfg.State.NotifyAgents == nil` を見れば「未設定」と「明示的な空」を区別できる。

### バナー抑制と未読マークを分離する

抑制対象でも `t=notify` フレームは配送し、`banner: false` を付ける。frontend の `notifyAgentWait()` は `banner === false` のとき未読マークだけ行い `showNotification()` を呼ばない。

**代替案（不採用）**: daemon 側でフレーム自体を落とす。実装は最小だが、未読ドットまで消えてしまう。長時間ビルドが OSC 9 を出すケースで「バナーは要らないが完了は知りたい」を満たせない。

### プロンプト復帰は `working` → `idle` のみを通知する

`Hub.lastAgent` に直前の state が既にあるので、遷移元を見て判定できる。

- `none` → `idle` を除外する理由: 新規セッションで agent を起動した直後、identity 確定と同時に `idle-safe` として `idle` が入る。ここで通知すると起動のたびに鳴る
- `blocked` → `idle` を除外する理由: 承認ダイアログにユーザーが答えた直後であり、ユーザーは既に画面の前にいる

evidence の質（idle パターン一致か quiescence のみか）では絞らない。`claude` / `codex` の実際の入力欄は枠線付きで描画され、manifest の idle パターン `^\s*(❯|>)\s*$` に一致しないことが多い。パターン一致を必須にすると「必ず通知する」という要件を満たせなくなる。

### OSC 9 のサブコマンド除外を同梱する

`OSC 9;4;…`（進捗）と `OSC 9;9;…`（cwd）は ConEmu 拡張であり待機通知ではないが、現在の `parseOSC()` は `9;` で始まる払い出しをすべて `EventNotify` にしている。許可リストを入れても、許可された agent が進捗を出せば鳴る。同じ「通知を静かにする」目的なので同じ change に含める。

## Risks / Trade-offs

- **`cursor-agent` の誤 idle 通知** → `cursor-agent` の `working` は activity 由来のみのため、静かに思考する時間が `quiescence_ms`（既定 1500ms）を超えると `idle` に落ちて通知が出る。緩和は 2 段構え。まず `state.quiescence_ms` を上げれば抑えられることを README に書く。恒久対策は `cursor-agent.json` に `working` の画面パターンを足すことだが、実機 fixture の再採取が必要なので別 change に切る
- **通知が二重に出る** → `claude` は hooks で OSC 9 を出す構成が README に載っており、OSC 到着と `working` → `idle` がほぼ同時に起きる。既存の 4 秒 first-wins arbiter が吸収する。arbiter を通す順序は既存経路と同じにする
- **既存ユーザーの挙動が変わる** → OSC を出す非 agent プロセスのバナーが既定で止まる。これは意図した変更だが、未読ドットは残るので取りこぼしにはならない。README の通知セクションに移行時の注意として明記する
- **祖先プロセス名照合による誤爆は解決しない** → `agent` という名前のプロセスが系列にいると `cursor-agent` と同定され、許可リストにも入っているため通知が出る。この change のスコープ外であることを明示し、別 change で `Registry.Resolve()` を見直す

## Migration Plan

1. 既存 config.json は `applyDefaults()` で `state.notify_agents` に既定値が入り、次回保存時に永続化される。手動移行は不要
2. `state.notify_agents` の変更は config patch (`PATCH /api/config`) なら即時反映される（Hub は毎回 `cfg.Get()` を読むため engine の再設定は不要）。config.json を直接編集した場合は、設定ファイルの監視機構がないので daemon 再起動が必要
3. ロールバック: `state.notify_agents` を `[]` にすると識別済み agent すべてが通る。`state.enabled=false` にすればフィルタ自体が外れて従来の OSC 挙動に戻る
