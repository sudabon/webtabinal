## 1. 前提

- [x] 1.1 `scope-agent-notifications` を archive し、`notification.commands` と `kind=agent_idle` が main specs に入っていることを確認する
- [x] 1.2 Claude Code の `Stop` hook が `WEBTABINAL_SESSION_ID` を継承するか実機で確認する。継承しない場合はタスク 5.1 の手順を `terminalSequence` 経由に切り替える

## 2. セッション通知エンドポイント

- [x] 2.1 `internal/server` に、認証済みリクエストで `notify` フレームが 1 回 broadcast されること、`kind` 既定が `agent_idle` で `source=hook` が付くこと、未知セッションが成功かつ無 broadcast になること、title/body 空が client error になること、未認証・異 Origin が拒否されることのテストを追加する
- [x] 2.2 `POST /api/sessions/{id}/notify` を実装し、既存の `withSecurity` 経路に乗せる。既存の arbiter を通してから broadcast する

## 3. `webtabinal notify` CLI

- [x] 3.1 `cmd/webtabinal` に引数パースのテストを追加する。`--session` 優先、`WEBTABINAL_SESSION_ID` へのフォールバック、`--title` / `--body` / `--kind`、不正引数の扱い
- [x] 3.2 `notify` サブコマンドを実装する。config から port と token を読み、エンドポイントを叩く。`state snapshot` と同じく daemon を起動しない
- [x] 3.3 daemon 未起動・セッション ID 不明・接続失敗のいずれでも終了コード 0 で無出力になることをテストする。hook のブロックを避けるための要件なので必ず自動テストで固定する

## 4. `state.notify_on_idle`

- [x] 4.1 `internal/config` に既定値 false、旧 config への補完、明示的 true の保持のテストを追加する
- [x] 4.2 `StateConfig` に `NotifyOnIdle` を追加し、`Defaults()` と `applyDefaults()` を実装する
- [x] 4.3 `internal/server/ws.go` の `agent_idle` 経路を `state.notify_on_idle` で制御する。既定オフで画面検知の通知が出ないことをテストする
- [x] 4.4 設定 UI「設定 → 通知」に画面検知プロンプト復帰通知のトグルを追加し、テストを足す

## 5. hook 設定と `hooks print`

- [x] 5.1 3 エージェント分の hook 断片を確定させる。cursor-agent は `~/.cursor/hooks.json` の `stop`、Claude Code は `~/.claude/settings.json` の `Stop`、Codex は hook なしで `[tui]` 設定のみ
- [x] 5.2 `webtabinal hooks print <agent>` を実装する。断片と貼り付け先パスを出す。未対応名は対応一覧を出して非ゼロ終了。設定ファイルは読み書きしない
- [x] 5.3 対応 3 エージェントの出力と未対応名の扱いのテストを追加する

## 6. ドキュメント

- [x] 6.1 README の Claude Code hook を `/dev/tty` から `terminalSequence` 方式に差し替える。現行 Claude Code では hook が制御端末を持たず、既存の手順が動かないため
- [x] 6.2 README にエージェント別の hook 設定手順を追加する。cursor-agent は対話モードでのみ hook が発火することも書く
- [x] 6.3 README の設定表に `state.notify_on_idle` を追加し、既定オフと移行手順（hook を入れるか true にするか）を書く
- [x] 6.4 README のトラブルシューティング表に「ターン完了の通知が来ない → hook 設定と `state.notify_on_idle` を確認」の行を追加する

## 7. 検証

- [x] 7.1 `go test ./...` と `cd web && node --test --experimental-strip-types tests/*.test.ts`、`npx tsc -b`、`npx oxlint` を実行する
- [x] 7.2 ライブ検証: 実 PTY で cursor-agent を対話起動し、`stop` hook から `webtabinal notify` が通り、`notify` フレームが 1 回だけ届くことを確認する
- [x] 7.3 ライブ検証: daemon を止めた状態で hook を発火させ、cursor-agent のターンがブロックされないことを確認する
- [x] 7.4 ユーザーによる実機確認: Claude Code / Codex / cursor-agent それぞれでターン完了時に通知が出ること、思考中の一時停止では出ないこと
