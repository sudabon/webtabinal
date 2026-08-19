## 1. OSC 9 サブコマンドの除外

- [x] 1.1 `internal/osc/parser_test.go` に `OSC 9;4;1;40` と `OSC 9;9;/path` が notify event を生成せず、`OSC 9;build finished` は従来どおり生成することを確かめるテストを追加する
- [x] 1.2 `internal/osc/parser.go` の `parseOSC()` で `9;` 払い出しのうち `4;` と `9;` で始まるものを notify event 化しないようにする

## 2. プロンプト復帰通知（daemon）

- [x] 2.1 `internal/server` に、`working` → `idle` で `kind=agent_idle` の notify フレームが 1 回出ること、`none` → `idle` と `blocked` → `idle` では出ないこと、同一 `idle` の再評価で重複しないことのテストを追加する
- [x] 2.2 `onAgentSnapshot()` に `attentionEvent()` を入れ、`h.lastAgent` の直前 state から `agent_blocked` / `agent_idle` を分類する
- [x] 2.3 プロンプト復帰イベントを既存の arbiter に通し、`kind=agent_idle`、`source=screen`、title に agent display name、body に入力待ちである旨を入れて broadcast する
- [x] 2.4 fake clock を使い、OSC 到着とプロンプト復帰が 4 秒窓内で重なったとき通知が 1 回に収束することを確かめるテストを追加する

## 3. daemon 側フィルタの撤去

- [x] 3.1 `internal/server/ws.go` の `bannerAllowed()` / `sessionAgentID()` と `banner: false` の付与を削除する。判定はクライアント側に一本化する
- [x] 3.2 `internal/server/notify_scope_test.go` を、フィルタ撤去後の挙動（未識別セッションや `generic` でも通常どおり notify フレームが飛ぶ）に合わせて書き直す
- [x] 3.3 `internal/config` から `StateConfig.NotifyAgents` と関連する既定値・バリデーション・テストを削除する

## 4. `notification.commands` 設定

- [x] 4.1 `internal/config/config_test.go` に既定値 `["claude","codex","cursor-agent","agent"]`、`notification` はあるが `commands` を持たない旧 config への既定値補完、明示的な空リストの保持、空白のみの要素を含む patch の拒否とロールバックのテストを追加する
- [x] 4.2 `NotificationConfig` に `Commands []string` を追加し、`Defaults()`・`applyDefaults()`・`validate()` を実装する。`clone()` の対象にも加える

## 5. ホワイトリスト判定（フロントエンド）

- [x] 5.1 `web/tests/notify.test.ts` に `commandAllowsNotification()` のテストを追加する。先頭トークンの basename 一致、引数とパスの無視、空リストでフィルタ無効、コマンド不明で不許可、リストにない場合は不許可
- [x] 5.2 `web/src/notify.ts` に `commandAllowsNotification(command, commands)` を実装する
- [x] 5.3 `web/src/types.ts` の `NotificationConfig` に `commands: string[]` を追加し、`ServerMsg.notify` から `banner` を除く
- [x] 5.4 `web/src/App.tsx` の `notifyCompletion()` と `notifyAgentWait()` の両方に判定を入れる。未読マークと Dock バッジは判定前に行い、バナーだけ抑止する。既定値にも `commands` を追加する
- [x] 5.5 `web/tests/app.test.ts` に、ホワイトリスト外のコマンド完了で未読は付くが通知が出ないこと、ホワイトリスト内なら通知が出ること、ホワイトリスト外セッションの `notify` フレームで未読だけ付くことのテストを追加する

## 6. 設定 UI

- [x] 6.1 `web/tests/settings-modal.test.ts` に、コマンド一覧の表示、追加、trim、空文字の握り潰し、重複の握り潰し、削除、失敗時のロールバックのテストを追加する
- [x] 6.2 `web/src/components/NotificationsSettings.tsx` にコマンド一覧の表示・追加フォーム・削除ボタンを追加する。空リストの意味を説明文で示す
- [x] 6.3 必要なスタイルを追加する

## 6.5 大文字小文字の取り違え対策

- [x] 6.5.1 `commandAllowsNotification()` の照合を大文字小文字非依存にする。macOS がテキスト欄の先頭を大文字化するため、`Task` と `task` の不一致で通知が黙って止まるのを防ぐ
- [x] 6.5.2 追加フォームの重複判定も大文字小文字非依存にする
- [x] 6.5.3 追加フォームの input に `autoCapitalize` / `autoCorrect` / `spellCheck` / `autoComplete` の抑止を付ける（既存のシェルパス欄・マニフェスト欄と同じ方針）

## 7. ドキュメントと検証

- [x] 7.1 README の通知セクションを、`notification.commands` を中心とした説明に書き換える。`state.notify_agents` の記述を差し替える
- [x] 7.2 README の設定表を `notification.commands` に更新し、`state.notify_agents` の行を削除する
- [x] 7.3 README のトラブルシューティング表の該当行を `notification.commands` に合わせて更新する
- [x] 7.4 `go test ./...` と `cd web && node --test --experimental-strip-types tests/*.test.ts`、`npx tsc -b`、`npx oxlint` を実行する
- [x] 7.5 ライブ daemon スモーク: `ls` で通知が出ないこと、ホワイトリストに `ls` を足すと出ること、エージェントのプロンプト復帰で出ることを確認する
- [ ] 7.6 ユーザーによる実機確認: 実際の `claude` / `codex` / `cursor-agent` でターン完了の通知が出ること、`ls` など日常コマンドで鳴らないこと、設定画面からコマンドを追加できることを確かめる
