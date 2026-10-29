# Design

## Context

- タブの右クリックは `web/src/components/Sidebar.tsx` の `SortableTab` で `window.prompt` を呼んでいるだけ。アクション自体（`onDuplicate` / `onRestart` / `onClose`）は `App.tsx` にあり、閉じる前の確認（`confirm_close_running`）も `closeTab` 側にある。
- タブは `@dnd-kit` の sortable で、`attributes` / `listeners` がタブ要素に展開されている。`PointerSensor` は 6px 移動で発火する。
- 通知はすべて `App.tsx` の `notifyCompletion` と `notifyAgentWait` を通り、最後に `showNotification` を呼ぶ。両者とも「未読マーク → コマンドのホワイトリスト判定 → 通知」の順で、ホワイトリストで落ちても未読は付く。
- メモはタブ単位の状態の前例: `session.Session.Memo` → `Info.memo` → `PATCH /api/sessions/{id}`、`Manager.SetMemo` が `onChange` で WS の `sessions` を配信、`Restart` は引き継ぎ、`Duplicate` は引き継がない。
- 既存のメモツールチップは `createPortal(document.body)` と `position: fixed` で、サイドバーのスクロールとリサイズで閉じる。同じ作法を流用できる。

## Goals / Non-Goals

**Goals:**
- 依存を増やさずに、自前の小さなメニューコンポーネントでコンテキストメニューを実装する。
- ミュートの判定を通知ゲートの 1 箇所に集約し、通知種別ごとの分岐を増やさない。

**Non-Goals:**
- サイドバー以外（ターミナル領域など）の右クリックメニュー。
- メニューへのショートカットキー表示や、キーボードからメニューを開く操作（Shift+F10 等）。
- デーモン再起動をまたぐ復元スナップショット（`internal/restore`）へのミュート状態の保存。
- グローバル通知設定 UI（`NotificationsSettings`）の変更。

## Decisions

### 1. メニューは自前の `TabContextMenu` コンポーネントを `App` 直下でポータル描画する

`Sidebar` が「どのタブのメニューを、どの座標で開いているか」（`{ sessionId, x, y } | null`）を 1 つだけ持ち、`TabContextMenu` を `createPortal(document.body)` で `position: fixed` 描画する。状態をタブごとではなくサイドバーに 1 つ置くことで「同時に開くのは 1 つ」が構造的に保証され、別タブの右クリックは座標とタブ ID の差し替えだけで済む。

- 代替案: Radix / Headless UI の DropdownMenu。キーボード操作と a11y は手に入るが、依存が増え、ポインタ座標に開く用途（トリガー要素基準ではない）には合わせ込みが要る。メニュー 4 項目に対して過剰なので見送る。
- 代替案: ネイティブ `<menu>` / Popover API。座標指定配置にはアンカー要素が必要で、結局 `fixed` + 座標計算になる。

### 2. 位置はポインタ座標を左上に置き、マウント後に実寸で補正する

初回は `left: x, top: y` で描画し、`useLayoutEffect` で `getBoundingClientRect()` を測って、右端を超えるなら `x - width`（それでも負なら `viewport - width - margin`）、下端を超えるなら `y - height` に寄せる。描画前に補正するのでちらつかない。

### 3. 閉じる条件はドキュメントレベルのリスナーで扱う

開いている間だけ `pointerdown`（capture、メニュー外判定）、`keydown`（Escape）、`.sidebar-tabs` の `scroll`、`window` の `resize` / `blur` を購読する。右クリックで別タブを開く場合は、`contextmenu` ハンドラが新しい状態をセットするだけで置き換わる（外側クリック判定で一度閉じても、続く `contextmenu` で開き直るので結果は同じ）。

### 4. dnd-kit との干渉を避ける

メニューはタブ要素の外（ポータル）にあるので、sortable の `listeners` はメニュー上のクリックを拾わない。タブ上の右ボタン押下はドラッグにならない（`PointerSensor` は主ボタンのみ発火）ことをテストで確認する。

### 5. キーボードと a11y

`role="menu"`、通常項目は `role="menuitem"`、通知は `role="menuitemcheckbox"` + `aria-checked`。無効の再起動は `aria-disabled="true"`（`disabled` 属性ではなくフォーカス移動から除外する形）。開いた時点で最初の有効項目にフォーカス、上下キーで有効項目間をローヴィング、Enter / Space で実行。閉じたとき、開く前の `document.activeElement` にフォーカスを戻す（ただし再起動・複製で `select` が走った場合は既存の「タブ選択後にターミナルへフォーカス」が優先される）。

### 6. ミュート状態はデーモンのセッションに持たせる（`notifications_muted`）

`session.Session` に `NotificationsMuted bool` を追加し、`Info` に `json:"notifications_muted"` で出す。ゼロ値が「通知オン」になるよう、肯定形の `notify` ではなく否定形のフラグにする（既存セッションや省略時に追加処理が要らない）。

- 代替案: クライアントの `localStorage`。リロードでは残るが、ネイティブ `.app` とブラウザ、複数ウィンドウで食い違う。メモと同じくデーモンを正とする。
- 代替案: グローバル設定 `notification.muted_sessions: []`。セッション ID は揮発するので設定ファイルに残すとゴミが溜まる。

### 7. PATCH はフィールド単位の部分更新、検証してから一括適用

`handlePatchSession` の body を `{ Memo *string; NotificationsMuted *bool }` にし、両方 nil なら 400。`Manager` に `PatchSession(id, memo *string, muted *bool)` を設け、メモの検証（トリム後 30 コードポイント）を先に済ませてから、セッションのロック内で両フィールドを更新し、`onChange` を 1 回だけ呼ぶ。これで「メモ不正ならミュートも未適用」を保証する。既存の `SetMemo` はこの関数の薄いラッパーとして残し、既存テストを壊さない。

`Restart` は `memo` と同様に `NotificationsMuted` を新セッションに引き継ぐ。`Duplicate` は引き継がない。

### 8. 通知ゲートは `notifyCompletion` / `notifyAgentWait` のホワイトリスト判定の隣に置く

両関数で `commandAllowsNotification` の直前（未読マーク付与の後）に、`sessionsRef.current` から該当セッションを引いて `notifications_muted` なら return する。判定を純関数 `sessionAllowsNotification(session)`（`notify.ts`）に切り出してユニットテストする。未読を付けた後で落とすので、ホワイトリストと同じく「バナーだけ止めて未読は残す」が自然に満たされる。

`notifyCompletion` は `state` メッセージ由来の `info` を受け取るが、`state` メッセージにはミュートが含まれない可能性があるため、判定は常に `sessionsRef`（`sessions` 同期で更新）から引く。

### 9. 切り替えは楽観的更新 + 失敗時ロールバック

通知項目を選ぶと即座にローカルの `sessions` を書き換えてメニューを閉じ、`api.patchSessionNotificationsMuted` を呼ぶ。失敗したら元の値に戻し、既存の `actionError` トーストで知らせる。WS の `sessions` 配信が来れば最終的にはそれが正になる。

### 10. ラベルは日本語

サイドバーの既存 UI（「＋ 新規タブ」「設定」）に合わせて「複製」「再起動」「閉じる」「通知」とする。

## Risks / Trade-offs

- [右クリック直後の `pointerdown` 外側判定でメニューが即閉じる] → 外側判定は capture の `pointerdown` で行い、`contextmenu` の後に開いた状態には同一イベントが届かないことをテストで確認する。届く場合は開いた直後のフレームまで購読開始を遅らせる。
- [セッション一覧の `sessions` 同期が `state` より遅れ、ミュート直後の通知が漏れる] → 楽観的更新でローカル `sessions` を即時更新するため、クライアント内では切替直後から有効。他クライアントは WS 配信までの短い遅延を許容する。
- [デーモン再起動後の復元でミュートが外れる] → Non-Goal として明示。必要になれば `restore.Entry` に追加フィールドとして足せる（スナップショットの後方互換は保てる）。
- [古いクライアントが `notifications_muted` を知らない] → 追加フィールドなので無視されるだけ。古いクライアントからはミュート中でも通知が出るが、単一ユーザーのローカルアプリでは実害が小さい。

## Migration Plan

スキーマ移行は不要。デーモンとフロントエンドを同時にビルド（`make build`）して配布する。ロールバックは前バージョンに戻すだけで、ミュート状態はメモリ上にしかないため後片付けも不要。
