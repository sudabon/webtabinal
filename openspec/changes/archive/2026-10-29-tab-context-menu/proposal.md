# Proposal

## Why

タブを右クリックすると `window.prompt` のモーダルが開き、`duplicate` / `restart` / `close` を文字で打ち込む必要があります。操作が遅く、打ち間違いは黙って無視され、どのアクションが今使えるのか（`restart` は終了済みタブだけ）も画面から分かりません。あわせて、通知はグローバル設定とコマンドのホワイトリストでしか制御できず、「このタブだけ今は通知を止めたい」ができません。

## What Changes

- タブの右クリックで出していた `window.prompt` を廃止し、クリックした位置を左上の起点として右下方向に開くプルダウン（コンテキスト）メニューに置き換える。
- メニュー項目は「複製」「再起動」「閉じる」「通知」の 4 つ。「再起動」は終了済みタブ以外では無効表示にする。
- 「通知」はチェック付きのトグル項目で、選ぶたびにそのタブの通知のオン / オフを切り替える。既定はオン。
- タブの通知をオフにすると、そのタブからはデスクトップ通知（コマンド完了・OSC 待ち・`blocked`・ターン完了・プロンプト復帰のすべて）を出さない。未読ドットと Dock バッジは従来どおり付ける。
- タブごとの通知オン / オフはデーモンのセッション状態として保持し、リロードや別クライアントからも同じ値が見える。「再起動」では引き継ぎ、「複製」では引き継がない（メモと同じ扱い）。
- `PATCH /api/sessions/{id}` が `memo` に加えて `notifications_muted` を受け付け、セッション情報に `notifications_muted` を含める。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `terminal-ui`: タブのコンテキストメニューの表示形式（位置・項目・無効表示・閉じ方）と、通知トグル項目の追加。
- `notifications`: タブ単位の通知ミュートを追加し、ミュート中のタブはデスクトップ通知を出さず未読マークだけ付ける。
- `transport-api`: セッションの PATCH とセッション情報に `notifications_muted` を追加。

## Impact

- フロントエンド: `web/src/components/Sidebar.tsx`（右クリック処理）、新規のコンテキストメニューコンポーネント、`web/src/App.tsx`（通知ゲートとミュート切替）、`web/src/api.ts`、`web/src/types.ts`、`web/src/index.css`。
- デーモン: `internal/session`（セッションのミュート状態、Restart での引き継ぎ）、`internal/server/api.go`（PATCH の受け付け項目）。
- 既存クライアントとの互換性: `memo` だけを送る PATCH は従来どおり動く。`notifications_muted` は省略時 `false`。
- デーモン再起動をまたぐセッション復元（`session-restore`）にはミュート状態を含めない。
