## Why

デーモンが止まると PTY ごとセッションが消えるため、再起動・ログアウト・クラッシュのあとにコーディングエージェント（Claude Code / Codex / cursor-agent）の作業タブが失われ、ユーザーは「どのディレクトリで何を動かしていたか」を思い出して手で開き直している。エージェント側は会話を永続化していて `claude --continue` や `codex resume --last` で再開できるのに、WebTabinal がその手掛かり（cwd とエージェント種別）を保持していないため再開が手作業になっている。

## What Changes

- デーモンが、エージェントを検出しているセッションの復元スナップショット（順序・cwd・メモ・エージェント ID・記録時刻）を Application Support 配下に永続化する。書き込みはセッション変更のたびにデバウンスして行い（クラッシュしても直近の状態が残る）、原子的な置換で更新する。
- デーモン起動時に、そのスナップショットからタブを再作成し、シェルのプロンプトが立ち上がったあとに各エージェントの resume コマンドを自動実行する。cwd とメモ、タブ順序も引き継ぐ。
- resume コマンドは組み込みの既定値（`claude`→`claude --continue`、`codex`→`codex resume --last`、`cursor-agent`→`cursor-agent resume`）を持ち、`config.json` の `restore.commands` でエージェント単位に上書き・無効化できる。表に無いエージェント（`generic` など）は復元対象外。
- 同一 `(エージェント, cwd)` の復元候補が複数ある場合、自動実行するのは最初の 1 本だけで、残りのタブは同じ cwd で作成し resume コマンドを入力行に置くだけにする（Enter は押さない）。同じ会話を二重に開かないための措置。
- 復元をスキップする条件を定義する: 機能が無効、cwd が存在しない、スナップショットが古すぎる（既定 72 時間）、上限本数超過（既定 8 本）、コマンド文字列が不正（空・改行を含む・長すぎる）。
- 設定 UI（General カテゴリ）に「エージェントセッションを復元」のトグルを追加する。resume コマンドの上書きは `config.json` のみで行う。
- **BREAKING** なし。既存の config は不足キーに既定値が埋まり、機能は既定で有効になる。

## Capabilities

### New Capabilities
- `session-restore`: エージェントセッションのスナップショット永続化と、デーモン起動時の復元・resume コマンド実行の規約

### Modified Capabilities
- `daemon-core`: `restore` 設定ブロック（`enabled` / `commands` / `max_sessions` / `max_age_hours`）の既定値・後方互換の埋め込み・patch バリデーションを追加
- `settings-ui`: General カテゴリに復元トグルを追加

## Impact

- Go: 新規 `internal/restore`（スナップショットの読み書き・resume コマンド解決）、`internal/paths`（スナップショットのパス）、`internal/session/manager.go`（変更監視と復元用セッション作成・コマンド投入）、`internal/config`（`restore` ブロック）、`cmd/webtabinal/main.go`（起動時の復元パスとシャットダウン時の保存）
- フロントエンド: `web/src/types.ts`、`web/src/components/GeneralSettings.tsx`（トグル）
- 永続データ: `~/Library/Application Support/WebTabinal/restore.json` を新規作成（0600、原子的置換）
- ドキュメント: README の設定一覧と復元挙動の説明
- 副作用: デーモン起動時にユーザーの端末で自動的にコマンドが実行される。実行対象は設定表から解決したコマンドのみに限定し、cwd 検証とコマンド検証、本数上限で影響範囲を抑える。
