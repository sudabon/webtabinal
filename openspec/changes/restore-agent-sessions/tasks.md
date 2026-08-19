## 1. 設定スキーマ

- [ ] 1.1 `internal/config/config.go` に `RestoreConfig`（`enabled bool` / `commands map[string]string` / `max_sessions int` / `max_age_hours int`）を追加し、`Config.Restore` として JSON キー `restore` で持たせる
- [ ] 1.2 `Defaults()` に `enabled=true`、`max_sessions=8`、`max_age_hours=72`、`commands` は空マップを追加する
- [ ] 1.3 `applyDefaults()` で、`restore` オブジェクトや個別キーが無い旧 config に既定値だけを埋め、明示的に保存された値（`enabled=false`、空文字コマンドを含む）を保持する
- [ ] 1.4 `clone()` で `commands` マップをコピーし、呼び出し側や `json.Unmarshal` が内部状態へ書き戻せないようにする
- [ ] 1.5 `Patch` のバリデーションに、`max_sessions` は 1–32、`max_age_hours` は 0 以上、`commands` の各値は 512 文字以内かつ CR/LF を含まない、キーは空白のみ不可、を追加し、違反時は保存済み設定を変更せずエラーを返す
- [ ] 1.6 `internal/config/config_test.go` に 1.3 と 1.5 のテスト（旧 config の埋め込み、空文字コマンドの保持、不正 patch の拒否）を追加する

## 2. スナップショットの永続化

- [ ] 2.1 `internal/paths/paths.go` に `RestorePath()`（Application Support 配下の `restore.json`）を追加する
- [ ] 2.2 `internal/restore` パッケージを作り、`Snapshot{Version int, UpdatedAt time.Time, Sessions []Entry}` と `Entry{Order int, Cwd, Memo, Agent string, SeenAt time.Time}` を定義する
- [ ] 2.3 `Save` を実装する: 同一ディレクトリの一時ファイルへ書いて `os.Rename` で置換、パーミッション 0600、親ディレクトリが無ければ作成
- [ ] 2.4 `Load` を実装する: ファイル無し・壊れた JSON・未知の `version` はエラーではなく「空のスナップショット」と理由を返し、呼び出し側が起動を続行できるようにする
- [ ] 2.5 `internal/restore` に 2.3 と 2.4 のテスト（往復、部分書き込みが観測されないこと、壊れたファイルの扱い、パーミッション）を追加する

## 3. 記録（Recorder）

- [ ] 3.1 `internal/restore` に、セッション一覧のスナップショット（順序・cwd・メモ・エージェント ID）を受け取って `[]Entry` を組み立てる純粋関数を実装する。エージェント ID が空、または resume コマンドを解決できない ID は除外する
- [ ] 3.2 5 秒周期で 3.1 を実行し、直前に書いた内容と異なるときだけ `Save` する Recorder を実装する。`Stop()` で goroutine を終わらせ、最後に同期書き込みを 1 回行う
- [ ] 3.3 `session.Manager` に、Recorder が必要とする最小限の読み取り口が揃っているか確認する（`List()` の `Info` に `Order` / `Cwd` / `Memo` / `Agent` が含まれること）。不足があれば `Info` ではなく Recorder 側の変換で埋める
- [ ] 3.4 `internal/restore` に Recorder のテスト（偽クロックで、変化なしなら書かない・cwd 変化で書く・エージェント終了でエントリが消える・`Stop()` で最終書き込み）を追加する

## 4. resume コマンドの解決

- [ ] 4.1 `internal/restore` に組み込みコマンド表（`claude` → `claude --continue`、`codex` → `codex resume --last`、`cursor-agent` → `cursor-agent resume`）を定義する
- [ ] 4.2 `config.RestoreConfig.Commands` で上書き解決する関数を実装する: 明示的な空文字はそのエージェントを無効化、未登録 ID は解決不能、解決結果は trim 後非空・CR/LF なし・512 文字以内を満たすこと
- [ ] 4.3 解決不能・検証エラーは理由付きの値で返し、呼び出し側がログに出せるようにする
- [ ] 4.4 4.1〜4.3 のテスト（既定値、上書き、空文字無効化、未登録 ID、改行入り・長すぎるコマンドの拒否）を追加する

## 5. 復元ポリシー

- [ ] 5.1 `internal/restore` に、スナップショットと設定と現在時刻から「復元する順序付きのプラン」を返す純粋関数を実装する。各要素は cwd・メモ・実行するコマンド・自動実行するか（改行を付けるか）を持つ
- [ ] 5.2 スキップ条件を実装する: cwd がディレクトリとして存在しない、`max_age_hours > 0` かつ `SeenAt` がそれより古い、`max_sessions` 超過、コマンド解決不能・検証エラー。各スキップは理由を伴って返す
- [ ] 5.3 同一 `(agent, cwd)` は記録順の先頭だけ自動実行、以降は改行なしの投入とする
- [ ] 5.4 5.1〜5.3 のテスト（順序保持、上限、TTL、存在しない cwd、重複 cwd の分岐、スキップ理由）を追加する

## 6. セッション作成とコマンド投入

- [ ] 6.1 `session.Manager` に復元用のセッション作成口を追加する（cwd とメモを指定して作成し、既存の `Create` を再利用する）
- [ ] 6.2 「プロンプト到達後に一度だけ文字列を書く」処理を実装する: 25 ms 間隔で `Info().State` を見て `starting` を抜けたら投入、最大 2000 ms で打ち切って投入、投入は 1 回のみ、セッションが既に終了していれば何もしない
- [ ] 6.3 6.2 のテスト（プロンプト到達で投入される、統合なしでもフォールバック時間後に投入される、二重投入されない）を追加する

## 7. デーモン起動時の組み込み

- [ ] 7.1 `cmd/webtabinal/main.go` の `runServe` で、Manager 作成後・HTTP 待ち受け開始前に復元パスを実行する（`restore.enabled=false` のときは何もせずスナップショットも消さない）
- [ ] 7.2 復元は既存セッションが 0 のときだけ実行し、プランの各要素についてセッションを作成 → メモ設定 → コマンド投入予約、の順で処理する
- [ ] 7.3 スナップショットの読み込み失敗・各エントリのスキップ・コマンド拒否をデーモンログに理由付きで記録する
- [ ] 7.4 復元後に Recorder を起動し、終了時（`mgr.Close()` の前）に最終書き込みが走るよう `defer` の順序を整える
- [ ] 7.5 `cmd/webtabinal` に起動経路のテストを追加する（無効時は何も作らない、スナップショット破損でも起動が続く、復元 → 再起動でタブが増殖しない）

## 8. 設定 UI

- [ ] 8.1 `web/src/types.ts` の設定型に `restore` を追加する
- [ ] 8.2 `web/src/components/GeneralSettings.tsx` に「エージェントセッションを復元」トグルを追加し、既存のトグルと同じく即時 PATCH で保存する。説明文に「復元したタブでは resume コマンドが自動実行される」ことを書く
- [ ] 8.3 `cd web && npm run lint` と `make build`（`tsc -b` を含む）が通ることを確認する

## 9. ドキュメントと最終確認

- [ ] 9.1 README の設定一覧に `restore.enabled` / `restore.commands` / `restore.max_sessions` / `restore.max_age_hours` と既定値を追記する
- [ ] 9.2 README に復元の挙動（対象はエージェント検出中のタブのみ、cwd・メモ・順序を引き継ぐ、resume コマンドが自動実行される、同一 cwd の 2 本目は入力のみ）と、`restore.json` を共有しない注意を追記する
- [ ] 9.3 `go test ./...` と `make build` を実行し、結果を記録する
- [ ] 9.4 実機確認: claude / codex のタブを開いた状態でデーモンを停止 → 起動し、タブと cwd が戻り resume コマンドが実行されること、`restore.enabled=false` では復元されないことを確認する
- [ ] 9.5 design.md の Open Questions（`cursor-agent resume` の実機挙動）を確認し、必要なら組み込み既定値を修正する
