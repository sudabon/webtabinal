## Context

サイドバー（`web/src/components/Sidebar.tsx`）は `App.tsx` から無条件に描画され、`.app` の flex 行の中で `flex-shrink: 0` の固定幅要素として常に場所を取ります。幅は `config.sidebar_width`（既定 240、160–480）に永続化されます。

キーボード面には既にプレフィックスコードの実装があります。`web/src/keymap.ts` の `resolveChordKey()` が純関数として `arm` / `next` / `prev` / `cancel` / `none` を返し、`App.tsx` の capture-phase `keydown` リスナがそれを解釈します。バインディングは Go 側 `internal/config/config.go` の `KeyBindingsConfig` に永続化され、`validateKeyBindings()` がフロントの `validateBindings()` と対になっています。マスタースイッチ `key_bindings.enabled` は既定 `false` です。

ネイティブ `.app` の Edit メニュー（`desktop/Sources/main.swift`）は Copy / Paste を持ち、いずれも `webView.evaluateJavaScript("window.__webtabinalClipboard && ...")` で Web 側のファサードを呼ぶ一方向ブリッジです。ファサードは `installTerminalClipboardFacade()` が `TerminalView` のマウント時に `window` へ生やします。

## Goals / Non-Goals

**Goals:**

- サイドバーを畳んでターミナルを全幅にできること。
- 既定でオフのショートカットに依存せず、ポインタ操作だけで必ず再展開できること。
- 既存のコード実装に 3 つ目のアクションを足すだけで済ませ、キー処理経路を二重化しないこと。
- 既存の設定ファイルを壊さないこと（`toggle_sidebar` を持たない config を既定値で補完する）。

**Non-Goals:**

- 折りたたみ状態の永続化。リロードで必ず展開に戻ります。
- サイドバーの「アイコンだけの細いレール」表示。畳んだときは完全に消します。
- Edit メニュー項目への macOS キー等価の割り当て。2 ストロークのコードは `NSMenuItem.keyEquivalent` で表現できません。
- `sidebar_width` の扱いの変更。

## Decisions

### 1. 折りたたみは `App` のローカル state、サイドバーは条件付きでアンマウント

`App.tsx` に `const [sidebarCollapsed, setSidebarCollapsed] = useState(false)` を置き、`{!sidebarCollapsed && <Sidebar … />}` とします。

- **なぜ `width: 0` / `display: none` ではなくアンマウントか**: サイドバーは `DndContext` と `SortableContext`、メモのツールチップタイマー、リサイザの `mousemove` ハンドラを抱えています。畳んでいる間これらを生かしておく理由がなく、非表示要素に残るドラッグ判定は事故のもとです。アンマウントなら `.main` の `flex: 1` が自動で全幅になり、CSS の追加はほぼ不要です。
- **ターミナルの再フィットは追加実装不要**: `TerminalView` は既に `ResizeObserver` で `fit.fit()` と WS `resize` を送ります（`TerminalView.tsx:137`）。レイアウトが変わればそのまま発火します。仕様の「resize が送られる」はこの既存経路で満たされ、新しい配線は入れません。
- **なぜ永続化しないか**: ユーザーの決定です。加えて、畳んだ状態で永続化すると「タブ一覧が消えたまま起動し、ショートカットは既定オフ」という詰みかけの初期状態を作り得ます。毎回展開で起動するほうが安全です。

### 2. 再展開コントロールはターミナルペイン左上のフローティングボタン

畳むボタンはサイドバー上端に薄いヘッダ行を新設して右寄せに置き、展開ボタンは `.main` の左上に `position: absolute` で重ねます。畳む / 開くで操作点が上端の同じ帯に留まり、視線が飛びません。

- **代替案（不採用）**: 畳むボタンを既存の下端「設定」行の隣に置く。ヘッダ行を足さずに済みますが、展開ボタン（上）と畳むボタン（下）が画面の対角に離れ、往復操作が苦しくなります。
- **代替案（不採用）**: 幅 24px の常設レールにアイコンだけ残す。全幅にならないので目的を半分しか達成しません。
- ショートカットが既定オフである以上、この展開ボタンが唯一の既定の復帰手段です（デスクトップ版のみ Edit メニューも使えます）。仕様で「常に見える」ことを要求済みです。

### 3. コードは既存 `resolveChordKey` を拡張し、アクションを 1 つ足す

`ChordAction` に `'toggle_sidebar'` を追加し、`resolveChordKey()` の `next_tab` / `prev_tab` 判定の後ろに `toggle_sidebar` 判定を足します。`KeyBindings` 型と `DEFAULT_KEY_BINDINGS` に `toggle_sidebar: 'j'` を加えます。

- **なぜ既存スイッチ相乗りか**: ユーザーの決定です。実装上も、プレフィックス `ctrl+j` の横取り可否を決める分岐が 1 か所に留まります。独立フラグにすると「タブ移動は無効だがサイドバーは有効」のとき `ctrl+j` を横取りするか否かの判断が `resolveChordKey` の外に漏れ、純関数のテスト容易性が落ちます。
- **既定値の衝突は起きない**: プレフィックス判定 `spec === bindings.prefix` が先に来るため、`ctrl+j` は常に arm、素の `j` は arm 済みのときだけ toggle に解決されます。
- `App.tsx` のハンドラは `result.action === 'toggle_sidebar'` で `setSidebarCollapsed((v) => !v)` を呼び、`clearPending()` 後に `return` します。タブ選択と違い `select()` を呼ばないため、フォーカスはターミナルに残ります（仕様の「フォーカスを保つ」を満たす）。

### 4. バリデーションは 3 者の相互排他に拡張

Go の `validateKeyBindings()` とフロントの `validateBindings()` の両方で、`next_tab` / `prev_tab` / `toggle_sidebar` の総当たり比較にします。エラー種別は既存の `next_prev_equal` を汎用名に置き換えるのではなく、意味の変わる箇所を最小にするため `duplicate_action_key`（メッセージ「移動キーとサイドバー開閉キーに同じキーは使えません」相当）へ改名し、`ISSUE_MESSAGE` を更新します。プレフィックスは他 3 キーと比較しません（修飾キーの有無で必ず異なるため）。

### 5. Go 側のマイグレーションは `applyDefaults()` の空文字補完に乗せる

`KeyBindingsConfig` に `ToggleSidebar` フィールド（JSON タグ `toggle_sidebar`）を追加し、`Defaults()` に `"j"`、`applyDefaults()` に `if s.cfg.KeyBindings.ToggleSidebar == "" { … }` を足します。既存 3 キーと同じ方式です。

- `Patch()` は現行 config の上に JSON を unmarshal するため、`toggle_sidebar` を含まない古いクライアントの PATCH でも既存値が保たれます。
- ただし `Patch()` は `validate()` を `applyDefaults()` より先に呼ぶので、空文字の補完は必ず読み込み時（`LoadOrCreate` → `applyDefaults`）に済んでいる必要があります。現状の呼び順がそうなっているので追加の並べ替えは不要です。

### 6. デスクトップは clipboard と同じ一方向 JS ブリッジ

`window.__webtabinalSidebar = { toggle() }` を `App.tsx` の `useEffect` で生やし（`installTerminalClipboardFacade` に倣ったアンインストール関数付き）、Swift 側は次を呼びます。

```swift
webView.evaluateJavaScript("window.__webtabinalSidebar && window.__webtabinalSidebar.toggle()")
```

- **`&&` ガードが「ロード前は不活性」を実現**: UI 未ロードならファサードが存在せず、式は falsy を返して何も起きません。仕様のシナリオはこれで満たされ、`NSMenuItem` の `validateMenuItem` を追加実装する必要はありません。
- **代替案（不採用）**: `WKScriptMessageHandler` で Web → Swift の状態同期を取り、メニュー項目にチェックマークを付ける。往復の状態同期が必要になる割に得るものが薄いので、項目名は状態非依存の「Toggle Sidebar」に固定します。
- メニュー項目のタイトルは既存メニューが英語（Copy / Paste / Hide）なので **Toggle Sidebar** とし、Paste の下に置きます。UI 側のボタンのラベル・`aria-label` は Web UI が日本語なので日本語にします。

### 7. 設定 UI は既存の記録行を 1 つ増やすだけ

`KeyboardSettings.tsx` の `Slot` に `'toggle_sidebar'` を足し、`sameBindings()` の比較に追加、記録行を「サイドバー開閉」として次タブ・前タブの下に置きます。リセットは `DEFAULT_KEY_BINDINGS` を丸ごと使っているので自動的に 4 キーを戻します。セクション見出しは「タブ移動」から「プレフィックスショートカット」へ、有効化チェックのヒントは両方のアクションに触れる文言へ更新します。

## Risks / Trade-offs

- **既定でショートカットが無効なため、ユーザーの要望どおり「Ctrl-J → J」が箱から出してすぐは効かない** → 設定の有効化チェックのヒントにサイドバー開閉を明記し、UI のボタンと Edit メニューを常に使える経路として残します。ユーザーが方針を選択済みの既知のトレードオフです。
- **サイドバーのアンマウントで、進行中のドラッグ操作や開いているコンテキストメニューが消える** → 実害は小さいですが、コンテキストメニューは `createPortal` で body に出ているためアンマウント時に取り残されないことを確認します（タスクに検証項目として入れます）。
- **`next_prev_equal` の改名がフロントのエラーメッセージ表と Go のエラー文言に波及する** → どちらもユーザー可視の文言のみで、API の契約は「4xx とメッセージ」のままです。既存テストの期待文字列を更新します。
- **展開ボタンがターミナル出力に重なる** → 左上の 1 文字分程度に留め、ホバーまでは低コントラストにします。全幅化の利益を損なうほどの面積は取りません。
- **`ctrl+j` は多くのシェルで改行（LF）として意味を持つ** → これは本変更で新たに生じるものではなく、既存のプレフィックス既定値がそのままです。有効化は引き続きユーザーの明示操作です。

## Migration Plan

1. Go 側（config のフィールドとバリデーション）→ フロント（`keymap.ts`）→ UI（`App` / `Sidebar` / `KeyboardSettings` / CSS）→ デスクトップ（Swift）の順に進めます。各層に既存のテストがあるので層ごとに検証できます。
2. 既存ユーザーの `~/.webtabinal/config.json` は `toggle_sidebar` を持ちませんが、`applyDefaults()` が読み込み時に `"j"` を補います。ユーザー操作は不要です。
3. ロールバックは変更のリバートのみで済みます。config に増えた `toggle_sidebar` キーは古いバイナリでは未知フィールドとして無視されます（`json.Unmarshal` の既定挙動）。データ移行は発生しません。

## Open Questions

なし。有効化方針（既存スイッチ相乗り）と永続化方針（保存しない）はユーザー確認済みです。
