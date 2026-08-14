## Context

タブクリックは `App.select` → `setActiveId` でセッションを切り替える。`TerminalView` は `sessionId` が変わると xterm を作り直すが、`term.focus()` はどこからも呼ばない。クリック対象はサイドバーのタブ要素なので、キーボードフォーカスはターミナルの hidden textarea（`xterm-helper-textarea`）に移らず、もう一度画面をクリックするまで入力できない。

同じタブの再クリックでは `sessionId` が変わらないため、セッション変更時の副作用だけでは足りない。ダブルクリックのメモ編集と設定モーダルは、それぞれの入力欄へフォーカスする既存経路があり、奪ってはいけない。

## Goals / Non-Goals

**Goals:**

- タブ選択（クリック、同じタブの再クリック、`Cmd+1`〜`9`）のあと、表示中のシェルへすぐ入力できる
- 新規タブ作成直後も入力できる
- 設定モーダル・タブメモ編集が開いているときは、その入力欄からフォーカスを奪わない
- セッション切り替え・xterm 再生成の既存契約は維持する

**Non-Goals:**

- タブの見た目や並び、ドラッグ順の変更
- フォーカスの可視化（独自キャレット、フォーカスリング）の新規デザイン
- ターミナル以外（サイドバー検索など、未実装の入力）へのフォーカス管理の一般化
- デスクトップ固有のフォーカス API。xterm の `focus()` でブラウザと `.app` の両方を賄う

## Decisions

### 1. フォーカスは xterm の `term.focus()` に任せる

- **選択**: 表示中インスタンスに `term.focus()` を呼ぶ。xterm が helper textarea にフォーカスを移す
- **理由**: クリック座標の合成や host div の `tabIndex` 操作より、xterm の正規 API が確実
- **代替案**: `.xterm-helper-textarea` を query して `HTMLElement.focus()` → 内部クラス名に依存するため不採用

### 2. 選択意図を `focusSeq` で明示する

- **選択**: `App` がタブ選択・新規作成のたびに数値をインクリメントし、`TerminalView` に渡す。`sessionId` 不変の再クリックでもフォーカスできる
- **`select` と `createTab`、`Cmd+1`〜`9`** がこの経路を使う。メモ編集の `onEditMemo` は `setActiveId` しても `focusSeq` を進めない
- **理由**: 「表示セッションが変わった」と「ユーザーが入力したい」を分ける。後者だけフォーカスする
- **代替案**: `sessionId` 変更時だけ `focus()` → 同じタブの再クリックが直らないため不採用

### 3. xterm 再生成後にフォーカスする

- **選択**: `TerminalView` の生成 effect（`[sessionId]`）のあとに、`focusSeq` / `sessionId` を見た effect で `termRef.current?.focus()` する。宣言順で生成が先になるようにする
- **理由**: セッション切り替えでは古い xterm が dispose される。生成前に `focus()` すると無効
- **代替案**: `requestAnimationFrame` や固定 delay → フレークしやすいので、effect 順と ref 更新で足りる範囲に留める

### 4. モーダル表示中はフォーカスしない

- **選択**: 設定またはメモモーダルが開いているときは `term.focus()` しない
- **理由**: メモはダブルクリックで `setActiveId` と同時に開く。セッション切り替えで xterm が再生成されても、メモ入力からフォーカスを奪わない
- **代替案**: 生成後に常に `focus()` し、モーダル側が後から取り返す → レースでターミナルに残ることがあるため不採用

## Risks / Trade-offs

- [セッション切り替え直後に古いインスタンスへ `focus()` する] → 生成 effect の後にフォーカス effect を置き、`termRef` が新しいインスタンスを指してから呼ぶ
- [メモ／設定の入力中にターミナルがフォーカスを奪う] → モーダル open 中は `focus()` しない。`onEditMemo` は `focusSeq` を進めない
- [初回マウントや通知クリックでフォーカスするか] → タブ選択と新規作成を必須とする。起動時の自動セッション表示は、ユーザーがすぐ打てると便利なので同じ `focusSeq` 経路に乗せてよい。通知クリックは `setActiveId` のみでもよく、必須にはしない

## Migration Plan

1. フロントのみ。設定ファイル・API・ネイティブシェルは変更しない
2. ロールバック: `focusSeq` と `term.focus()` を外せば旧挙動

## Open Questions

- なし
