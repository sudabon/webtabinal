## 1. 採取結果の確定

- [x] 1.1 バックグラウンド実行中の行を `✻ Churned for 30m 19s · 2 shells still running` として確定する
- [x] 1.2 変動部分（動詞・経過時間・件数・対象名詞）と不変部分（`✻`、`still running`）を洗い出す
- [x] 1.3 採取結果を design.md の Open Questions / Decisions に反映する
- [x] 1.4 実装時に `claude --version` を記録する。実機採取できれば `verified_against` にその値を使い、できなければ合成 fixture 名で代替する

## 2. Fixture の作成

- [x] 2.1 採取文字列から合成 fixture を `tests/fixtures/agents/claude/` に起こし、`metadata.json` の `notes` に合成である旨と元文字列を明記する
- [x] 2.2 バックグラウンド実行中 fixture（採取行 + 入力プロンプト）の `case.json` に `state: working` / `signal: screen` を期待する step を定義する
- [x] 2.3 ターン完了のみの負例 fixture（`✻ Churned for 30m 19s` + 入力プロンプト、`still running` なし）を作り、新パターンが不一致で `idle` になることを定義する
- [x] 2.4 バックグラウンドタスク完了後に `idle` へ落ちる遷移 fixture を作成する
- [x] 2.5 承認プロンプトと採取行が同時に出る fixture を作成し、`blocked` を期待する
- [x] 2.6 実機で `scripts/record-agent-fixture.sh --agent claude --version <実バージョン> --scenario background -- claude` が取れる場合は合成 fixture を実機版で置き換え、`stream.raw` に秘匿情報がないことを確認する

## 3. Manifest の更新

- [x] 3.1 `internal/agentdetect/manifests/claude.json` の `screen.states.working` に id `background`、pattern `✻.+still running` を追加する
- [x] 3.2 ターン完了行（`still running` なし）に一致せず、`shells` 以外の同型（例: `1 local agent still running`）には一致することを確認する
- [x] 3.3 fixture 上の行位置を見て、必要なら `bottom_lines` を調整する
- [x] 3.4 `verified_against` にタスク 1.4 のバージョン（または合成 fixture 名）を追記する

## 4. テスト

- [x] 4.1 新規 fixture を golden / replay test harness に登録する
- [x] 4.2 バックグラウンド実行中に `working` を維持することを検証するテストを追加する
- [x] 4.3 バックグラウンド完了後に `idle` へ落ちることを検証するテストを追加する
- [x] 4.4 ターン完了行（`still running` なし）が `idle` のままであることを検証するテストを追加する
- [x] 4.5 承認プロンプトが同時に出た場合に `blocked` が優先されることを検証するテストを追加する
- [x] 4.6 既存の `idle` / `unknown` fixture に新パターンが誤一致しないことを検証するテストを追加する
- [x] 4.7 `go test ./...` と `make test` を実行し、既存テストの回帰がないことを確認する

## 5. ドキュメント

- [x] 5.1 README の Claude Code 対応・通知の節に、バックグラウンド実行中は `working` を維持することと、画面由来の prompt-return 通知がバックグラウンド完了まで遅延することを追記する
- [x] 5.2 CONTRIBUTING の manifest / fixture 保守手順に、本パターンの再採取方法を追記する

## 6. 検証

- [x] 6.1 `make desktop` で再ビルドし、実機でバックグラウンドタスク実行中に state pill が working を示すことを確認する
- [x] 6.2 バックグラウンドタスク完了後に pill が idle へ戻ることを確認する
- [x] 6.3 ターン完了だけの `✻ … for <duration>` 表示では pill が idle のままであることを確認する
- [x] 6.4 承認待ちの通知が従来どおり発火することを確認する
- [x] 6.5 stop hook 由来のターン完了通知が従来どおり発火することを確認する
