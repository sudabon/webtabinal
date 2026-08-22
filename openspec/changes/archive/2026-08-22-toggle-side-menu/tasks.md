## 1. デーモン設定（Go）

- [x] 1.1 `internal/config/config.go` の `KeyBindingsConfig` に `ToggleSidebar` フィールド（JSON タグ `toggle_sidebar`） を追加し、`Defaults()` の `KeyBindings` に `ToggleSidebar: "j"` を設定する
- [x] 1.2 `applyDefaults()` に `s.cfg.KeyBindings.ToggleSidebar == ""` の空文字補完を既存 3 キーと同じ形で追加する
- [x] 1.3 `validateKeyBindings()` のスロット一覧に `toggle_sidebar` を加え、`next_tab` / `prev_tab` / `toggle_sidebar` の総当たり重複チェックに置き換える（重複時のエラー文言も 3 者を指すよう更新）
- [x] 1.4 `internal/config/config_test.go` に追加: 初回起動の既定が `toggle_sidebar: "j"` であること、`toggle_sidebar` を持たない既存 config が読み込みで `"j"` に補完されつつ他 3 キーが保持されること
- [x] 1.5 `internal/config/config_test.go` に追加: `toggle_sidebar` が `next_tab` と等しい PATCH が拒否され、保存済み値が変わらないこと。既存の重複拒否テストの期待文言を更新する
- [x] 1.6 `go test ./internal/config` が通ることを確認する

## 2. キーマップ（フロント純ロジック）

- [x] 2.1 `web/src/keymap.ts` の `KeyBindings` 型に `toggle_sidebar: string` を追加し、`DEFAULT_KEY_BINDINGS` に `toggle_sidebar: 'j'` を設定する
- [x] 2.2 `ChordAction` に `'toggle_sidebar'` を追加し、`resolveChordKey()` の `prev_tab` 判定の後ろに `toggle_sidebar` 判定を挿入する（未束縛キーは従来どおり `cancel`）
- [x] 2.3 `BindingIssue` の `next_prev_equal` を `duplicate_action_key` に改名し、`validateBindings()` を 3 キーの総当たり比較にする。`toggle_sidebar` も `unparsable` / `escape` チェックの対象に含める
- [x] 2.4 `web/src/types.ts` の設定 DTO が新しい `KeyBindings` 型を参照していることを確認する（`keymap.ts` の型を再利用しているなら変更不要）
- [x] 2.5 `web/tests/keymap.test.ts` に追加: プレフィックス → `j` が `toggle_sidebar` を返すこと、`enabled: false` では `none` のままであること、`toggle_sidebar` が `next_tab` と等しい集合が `duplicate_action_key` で弾かれること
- [x] 2.6 `cd web && node --test --experimental-strip-types tests/keymap.test.ts` が通ることを確認する

## 3. サイドバー開閉 UI

- [x] 3.1 `web/src/App.tsx` に `sidebarCollapsed` の `useState`（初期 `false`）と `toggleSidebar` コールバックを追加する
- [x] 3.2 `<Sidebar />` を `{!sidebarCollapsed && …}` で条件付き描画にする
- [x] 3.3 `Sidebar.tsx` の props に `onCollapse` を足し、タブ一覧の上に折りたたみボタンを持つヘッダ行を追加する（`aria-label` は「サイドバーを閉じる」）
- [x] 3.4 `App.tsx` に、`sidebarCollapsed` のとき `.main` 左上へ重なる展開ボタンを追加する（`aria-label` は「サイドバーを開く」）
- [x] 3.5 `web/src/index.css` にヘッダ行と展開ボタンのスタイルを追加する。展開ボタンは `position: absolute` でターミナル出力に重ね、ホバーまで低コントラストにする
- [x] 3.6 `App.tsx` のコードハンドラで `result.action === 'toggle_sidebar'` を処理する。`clearPending()` の後に `toggleSidebar()` を呼び、`select()` は呼ばずに `return` する（ターミナルのフォーカスを保つ）

## 4. 設定 UI

- [x] 4.1 `web/src/components/KeyboardSettings.tsx` の `Slot` に `'toggle_sidebar'` を追加し、`sameBindings()` の比較に含める
- [x] 4.2 「前のタブ」の下に「サイドバー開閉」の記録行を追加する（`aria-label` は「サイドバー開閉」）
- [x] 4.3 `ISSUE_MESSAGE` を `duplicate_action_key` に合わせて更新し、移動キーとサイドバー開閉キーの重複を説明する文言にする
- [x] 4.4 セクション見出しを「タブ移動」から「プレフィックスショートカット」へ、有効化チェックのヒントをタブ移動とサイドバー開閉の両方に触れる文言へ更新する
- [x] 4.5 リセットボタンが `DEFAULT_KEY_BINDINGS` 経由で 4 キーすべてを既定に戻すことを確認する（実装変更が不要なら確認のみ）
- [x] 4.6 `web/tests/settings-modal.test.ts` と `web/tests/app.test.ts` の `KeyBindings` リテラルに `toggle_sidebar` を補い、型エラーを解消する

## 5. デスクトップ（Swift）

- [x] 5.1 `App.tsx` に `window.__webtabinalSidebar = { toggle }` を生やす `useEffect` を追加する（アンマウント時に削除、`installTerminalClipboardFacade` の形に倣う）
- [x] 5.2 `desktop/Sources/main.swift` の Edit メニューに Paste の下へ `Toggle Sidebar` 項目を追加する。`keyEquivalent` は `""`、`target` は self
- [x] 5.3 `@objc func toggleSidebarFromWeb(_:)` を追加し、`webView.evaluateJavaScript("window.__webtabinalSidebar && window.__webtabinalSidebar.toggle()")` を呼ぶ。`webView` の nil ガードは Copy / Paste と同じ形にする
- [x] 5.4 `make desktop-test` が通ることを確認する

## 6. 検証

- [x] 6.1 `go test ./...` と `cd web && node --test --experimental-strip-types tests/*.test.ts` を実行し、全件通ることを確認する
- [x] 6.2 `cd web && npm run build`（`tsc -b` 込み）と `npm run lint` が通ることを確認する
- [x] 6.3 `make serve` で手動確認: サイドバーを畳むとターミナルが全幅になり、シェルが新しい桁数を認識する（`tput cols` などで確認）
- [x ] 6.4 手動確認: 畳んだ状態で展開ボタンだけを使って戻せる。リロードすると必ず展開状態に戻り、幅は元のまま
- [x ] 6.5 手動確認: 設定でショートカットを有効化したのち `Ctrl+J` → `J` で開閉でき、両キーストロークが PTY に届かない。無効のときは両方 PTY に届く
- [x ] 6.6 手動確認: 畳んでいる間にコンテキストメニューが body に取り残されないこと、ドラッグ中に畳んでも壊れないこと
- [x ] 6.7 `make desktop` でビルドした `.app` の Edit → Toggle Sidebar が動作し、キーボードショートカットが項目に表示されないことを確認する
