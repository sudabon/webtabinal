# Tasks

## 1. デーモン: セッションの通知ミュート状態

- [x] 1.1 `internal/session/session.go` の `Session` に `NotificationsMuted bool`、`Info` に `NotificationsMuted bool \`json:"notifications_muted"\`` を追加し、`Info()` で詰める。`go test ./internal/session/...` が通ることを確認する
- [x] 1.2 `internal/session/manager.go` に `PatchSession(id string, memo *string, muted *bool)` を追加する（メモ検証を先に行い、成功時のみ両フィールドを更新、`onChange` を 1 回呼ぶ）。`SetMemo` はそのラッパーにする。不正メモ＋ミュート同時指定でミュートが変わらないこと、`onChange` が 1 回だけ呼ばれることを `manager_memo_test.go` 相当のテストで確認する
- [x] 1.3 `Manager.Restart` でミュートを新セッションに引き継ぎ、`Duplicate` では引き継がないことを実装し、それぞれのユニットテストで確認する

## 2. デーモン: PATCH API

- [x] 2.1 `internal/server/api.go` の `handlePatchSession` を `{ memo?: string, notifications_muted?: bool }` の部分更新に変更し、両方欠落なら 400、型違いは 400 にする。`internal/server/session_memo_test.go` に「ミュートのみ」「メモ不正＋ミュートで 400・未適用」「空ボディで 400」「既存のメモのみ PATCH が従来どおり」のテストを追加し `go test ./internal/server/...` で確認する
- [x] 2.2 一覧・作成・WS `sessions` ペイロードに `notifications_muted` が含まれることをサーバーテストで確認する
- [x] 2.3 README の REST API 説明（該当箇所があれば）に `notifications_muted` を追記し、記述が実装と一致することを確認する

## 3. フロントエンド: 型・API・通知ゲート

- [x] 3.1 `web/src/types.ts` の `SessionInfo` に `notifications_muted?: boolean` を追加し、`web/src/api.ts` に `patchSessionNotificationsMuted(id, muted)` を追加する。`npm run build`（型チェック）が通ることを確認する
- [x] 3.2 `web/src/notify.ts` に `sessionAllowsNotification(session)` を追加し、`web/tests/notify.test.ts` にミュート時 false・未設定 / false 時 true のテストを追加して `npm test` で確認する
- [x] 3.3 `App.tsx` の `notifyCompletion` と `notifyAgentWait` で、未読マーク付与の後・ホワイトリスト判定の前に `sessionsRef` から引いたセッションでミュート判定を行う。`web/tests/app.test.ts` で「ミュート中は `showNotification` が呼ばれず未読は付く」「他タブは通知される」を確認する
- [x] 3.4 `App.tsx` にミュート切替ハンドラ（楽観的更新、失敗時ロールバック＋`actionError` 表示）を追加し、成功・失敗両方のケースを `app.test.ts` で確認する

## 4. フロントエンド: タブのコンテキストメニュー

- [x] 4.1 `web/src/components/TabContextMenu.tsx` を新規作成する（ポータル＋`position: fixed`、ポインタ座標を左上に配置し `useLayoutEffect` で画面内に補正、項目は 複製 / 再起動 / 閉じる / 通知、再起動は exited 以外 `aria-disabled`、通知は `menuitemcheckbox` + `aria-checked`）。位置補正ロジックは純関数に切り出し、右端・下端・両方はみ出しのケースをユニットテストで確認する
- [x] 4.2 メニューの閉じ条件（項目選択・Escape・外側 pointerdown・サイドバー scroll・window resize / blur）とキーボード操作（初期フォーカス、上下で有効項目のみ移動、Enter / Space 実行、閉じたらフォーカス復帰）を実装し、テストで確認する
- [x] 4.3 `Sidebar.tsx` の `onContextMenu` から `window.prompt` を削除し、サイドバーで `{ sessionId, x, y } | null` を 1 つ持ってメニューを開く。`Props` に `onToggleNotifications(id)` を追加し `App.tsx` から渡す。別タブの右クリックでメニューが置き換わること、右クリックでドラッグが始まらないことを手動確認する
- [x] 4.4 `web/src/index.css` にメニューのスタイル（既存のツールチップ / トーストと同じカラートークン、ライト / ダーク両対応、無効項目・チェック表示・フォーカスリング）を追加し、両テーマで見た目を確認する
- [x] 4.5 `npm run lint` と `npm test` が通ることを確認する

## 5. 統合確認

- [x] 5.1 `make build` 後に `./bin/webtabinal serve` で起動し、ブラウザで以下を確認する: 右クリックでダイアログが出ずクリック位置の右下にメニューが開く／画面下端・右端で画面内に収まる／複製・再起動（exited のみ）・閉じる（実行中は確認あり）が動く／通知トグルでチェックが切り替わり、ミュート中のタブでは非アクティブ時にバナーが出ず未読ドットは付く／リロード後もミュートが残る
- [x] 5.2 `go test ./...` と `cd web && npm test` を通しで実行し、全件成功を確認する
