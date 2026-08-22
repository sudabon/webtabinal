## Why

左サイドバーは常時表示で、幅を 160px 未満に縮めることもできません。長いコマンド出力や横に広いログを読むとき、ターミナルペインに割ける横幅がサイドバー分だけ恒久的に削られます。ユーザーが必要なときだけタブ一覧を出せるように、サイドバーを一時的に畳めるようにします。

## What Changes

- 左サイドバーに開閉トグルを追加する。畳んだときサイドバーは描画されず、ターミナルペインがウィンドウ幅いっぱいに広がる。
- 畳んだ状態でも再展開できる常設コントロールを UI 上に残す（キーボードショートカットが既定で無効なため、マウスだけで必ず戻せることを保証する）。
- 既存のプレフィックスコード（`key_bindings`）に 3 つ目のアクション `toggle_sidebar` を追加する。既定は `j`、つまり既定のプレフィックス `ctrl+j` と合わせて **Ctrl+J → J**。
- `toggle_sidebar` は既存の「タブ移動ショートカット」マスタースイッチ `key_bindings.enabled`（既定 OFF）に相乗りする。OFF の間は従来どおりプレフィックスを一切横取りしない。
- 設定モーダルの「キーボード」カテゴリに `toggle_sidebar` のキー記録行を追加し、既存のリセットボタンの対象に含める。
- バリデーションに `toggle_sidebar` を追加する。`next_tab` / `prev_tab` / `toggle_sidebar` の 3 者はすべて相異なることを要求する。
- ネイティブ `.app` の Edit メニューに「サイドバーの表示 / 非表示」を追加する。macOS のメニュー項目は 2 ストロークのコードを keyEquivalent として表現できないため、この項目はキー等価を持たず、Copy / Paste と同じ JS ブリッジ経由で Web 側のトグルを呼ぶ。
- 開閉状態は永続化しない。リロードおよびデーモン再起動後は必ず展開状態に戻る（`sidebar_width` の永続化は現状のまま）。

## Capabilities

### New Capabilities

なし。既存ケーパビリティの拡張のみです。

### Modified Capabilities

- `keyboard-shortcuts`: プレフィックスコードのアクションに「サイドバー開閉」を追加。バインディング集合が `toggle_sidebar` を含むようになり、相互排他バリデーションが 3 者間に拡張される。既定値と「既定では無効」の規定に `toggle_sidebar: j` が加わる。
- `terminal-ui`: 左サイドバーが折りたたみ可能になる。折りたたみ時のレイアウト、再展開コントロール、折りたたみ状態を永続化しないことを規定する。
- `settings-ui`: キーボードカテゴリにサイドバー開閉キーの記録行が加わり、リセットの対象になる。
- `desktop-shell`: Edit メニューにサイドバー開閉項目が加わる。

## Impact

- `internal/config/config.go` — `KeyBindingsConfig` に `ToggleSidebar` フィールド、`Defaults()`、`validateKeyBindings()`
- `internal/config/config_test.go` — 既定値・バリデーション・パッチのテスト
- `web/src/keymap.ts` — `KeyBindings` 型、`DEFAULT_KEY_BINDINGS`、`ChordAction`、`resolveChordKey()`、`validateBindings()`
- `web/src/types.ts` — 設定 DTO
- `web/src/App.tsx` — 折りたたみ状態、コードハンドラの分岐、`Sidebar` への props、再展開コントロールの描画
- `web/src/components/Sidebar.tsx` — 折りたたみトグルボタン
- `web/src/components/KeyboardSettings.tsx` — `Slot` 型と記録行、比較関数
- `web/src/index.css` — 折りたたみ時のレイアウトと再展開コントロールのスタイル
- `desktop/Sources/main.swift` — Edit メニュー項目と `evaluateJavaScript` ブリッジ
- `web/src/clipboard.ts` 相当の window グローバル方式にならった新しいブリッジ（サイドバートグル用）
- 既存の設定ファイルには `toggle_sidebar` が無いため、読み込み時に既定値で補完される必要がある（マイグレーション扱い）
