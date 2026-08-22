## Context

Agent state は manifest 駆動の画面判定で決まる。`internal/agentdetect/evaluate.go` の `recomputeLocked` は `blocked` → OSC → `working` → `idle` の順に証拠を評価し、先に成立したものを採用する。`claude` manifest（`internal/agentdetect/manifests/claude.json`）は `bottom_lines: 15` の範囲に対して以下を照合する。

- `working`: `esc to interrupt`、スピナー文字
- `idle`: `^\s*(❯|>)\s*$`

Claude Code がバックグラウンドタスクを実行している間、`esc to interrupt` もスピナーも表示されない一方で入力プロンプトは残る。結果として `idle` 側だけが成立し、state pill が待機中を示す。

採取したバックグラウンド実行中の行は次のとおり。

```
✻ Churned for 30m 19s · 2 shells still running
```

同じ行形式は、対象が shell 以外でも `still running` で終わる（公開事例: `Churned for 3m 1s · 1 local agent still running`）。一方、ターン完了だけの行は `✻ Churned for 30m 19s` のように `still running` を持たない。後者は idle であり、`working` に倒してはならない。

## Goals / Non-Goals

**Goals:**

- Claude Code のバックグラウンドタスク実行中に agent state を `working` に保つ
- ターン完了だけの `✻ … for <duration>` 行を `working` に誤一致させない
- Go / React のコードと WS プロトコルを変更しない
- 将来 Claude Code の表示が変わったときに、パターンの失効を fixture で検出できるようにする

**Non-Goals:**

- Codex / cursor-agent / generic manifest への同種パターン追加（表示形式が未調査）
- `working-background` のような新しい agent state の導入
- 通知ロジック（`internal/server/ws.go` の `attentionEvent`）の変更
- バックグラウンドタスクの件数や内容の UI 表示
- changelog に出る別形式 `Waiting for N background agents/workflows to finish` の対応（採取画面に現れなければスコープ外）

## Decisions

### manifest のパターン追加のみで実現し、Go 側は触らない

`recomputeLocked` は既に `working` を `idle` より先に評価するため、`screen.states.working` にパターンを1つ足すだけで目的の挙動になる。Go の判定ロジック、`State` 型、WS メッセージ、React 側はいずれも変更不要である。

代替案として `Inspector`（プロセステーブル観測）でバックグラウンドプロセスを検出する案があるが、Claude Code のバックグラウンドタスクは `claude` プロセスの子として動くため前景プロセス判定では区別できず、判定コストも上がる。画面に目印が出ている以上、既存の screen 判定で足りる。

`state.manifest_dir` によるローカル上書きが既に存在するため、パターンが将来失効しても利用者は daemon の再ビルドなしに手元で修正できる。

### `working` に倒し、新しい state を作らない

`idle` と `working` の二値で扱う。通知への影響は次のとおりで、実害が小さいと判断した。

- `blocked`（承認待ち）は `working` より先に評価されるため、承認待ち通知は影響を受けない
- stop hook 由来のターン完了通知は画面状態に依存しないため、ターン終了時に従来どおり発火する
- 画面由来の prompt-return 通知（`state.notify_on_idle`、既定で無効）のみ、バックグラウンドタスク完了まで遅延する

新 state の追加は `State` 型、WS プロトコル、React の pill、通知分岐、既存 spec すべてに波及する一方、得られるのは既定で無効な通知1種の発火タイミングの差でしかない。割に合わない。

### アンカーは `✻` と `still running` の組み合わせにする

採取行を分解すると次のとおり。

| 部分 | 例 | 扱い |
| --- | --- | --- |
| 行頭記号 | `✻` | 不変。Claude Code のターン要約行の目印 |
| 動詞 | `Churned` | 変動。Claude Code は過去形動詞をランダムに出す |
| 経過時間 | `30m 19s` | 変動。`5s` / `1m 2s` / `2h 3m 4s` など |
| 区切り | ` · ` | 件数付きのときに出る |
| 件数 | `2` | 変動。`1` のときは名詞が単数になる |
| 対象 | `shells` | 変動。`shell` / `local agent` などもあり得る |
| 末尾 | `still running` | 不変。バックグラウンド作業が残っている印 |

採用するパターンは `✻.+still running`（id: `background`）。`still running` が無いターン完了行（`✻ Churned for 30m 19s`）には一致しない。動詞・時間・件数・対象名詞を固定しないことで、shell 以外の同型表示にも追従する。

`still running` 単独は通常のコマンド出力に混ざる余地があるため、行頭記号 `✻` を必須にする。既存の `idle` / `unknown` fixture に対して不一致であることをテストで確認する。

### パターンは採取文字列から合成 fixture を起こし、可能なら実機でも固定する

文字列は確定した。実装では採取文字列から合成 fixture を `tests/fixtures/agents/claude/` に起こし、`metadata.json` の `notes` に合成である旨と元文字列を明記する。実機で `webtabinal state snapshot` と `scripts/record-agent-fixture.sh` が取れる場合は、それを優先して versioned fixture にし、`verified_against` に Claude Code の実バージョンを書く。実機が取れない場合は `verified_against` に合成 fixture の version ディレクトリ名を追記する（既存の `synthetic-claude-code-tui` と同じ運用）。

合成 fixture には少なくとも次を含める。

- バックグラウンド実行中: 採取行 + 入力プロンプト → `working` / `screen`
- ターン完了のみ: `✻ Churned for 30m 19s` + 入力プロンプト → `idle`（新パターン不一致）
- バックグラウンド完了後: 採取行が消え、入力プロンプトのみ → `idle`
- 承認プロンプト同時: 採取行 + `Do you want to` → `blocked`

## Risks / Trade-offs

- **採取した文字列が Claude Code のバージョン更新で変わり、パターンが失効する** → `verified_against` に採取バージョンを記録し、fixture の golden test で失効を検出する。利用者側は `state.manifest_dir` で先行修正できる
- **ターン完了行 `✻ … for <duration>` を誤って `working` にする** → パターンに `still running` を必須とし、その行を負例 fixture にする
- **パターンが過剰一致し、セッションが `working` に張り付く** → `✻` と `still running` の両方を要求する。既存の `idle` / `unknown` fixture に対して不一致であることをテストで確認する
- **対象名詞が `shells` 以外でも同型の行が出る** → 名詞を固定せず `still running` で吸収する。公開事例の `local agent still running` も同じパターンで拾える
- **バックグラウンドタスクの表示が下端15行の外に出る** → `bottom_lines` の拡大が必要になる。fixture 作成時に行位置を確認し、必要なら `claude` manifest の `bottom_lines` 調整を実装スコープに含める
- **prompt-return 通知が遅延する** → 既定で無効な通知であり、stop hook 経由のターン完了通知が代替として機能する。README の通知節にこの挙動を追記して周知する

## Open Questions

- 採取画面に `Waiting for N background agents/workflows to finish` が同時に出るか。出なければ本 change では扱わない。実装時点の Claude Code は 2.1.239 で、パターンはこのバージョンの採取行から合成 fixture を起こして `verified_against` に記録した
