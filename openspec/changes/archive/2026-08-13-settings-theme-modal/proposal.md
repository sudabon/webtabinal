## Why

WebTabinal の UI と xterm テーマはダーク固定で、OS のライト/ダーク設定や個人の好みに合わせられない。設定画面もなく、今後の設定項目を置く場所がない。

## What Changes

- サイドバー下部（新規タブの下）に「設定」入口を追加する
- 設定モーダル（左メニュー / 右パネル）を追加する。初期は「外観」のみ、他メニュー枠は後続追加可能にする
- テーマを `light` / `dark` / `system`（OS 追従）から選べるようにする
- 変更は即時適用・即時保存（保存ボタンなし）。モーダルはキャンセル（閉じる）のみ
- UI（CSS 変数）と xterm テーマを選択に連動させる
- サーバー設定（`/api/config`）に `color_scheme` を追加する

## Capabilities

### New Capabilities

- `settings-ui`: サイドバーからの設定モーダル（左ナビ + 右パネル、即時保存、閉じる操作）
- `color-scheme`: ライト / ダーク / システム追従のテーマ選択と、UI・ターミナルへの適用

### Modified Capabilities

- （なし — 既存スペックの要件変更はない）

## Impact

- Frontend: `Sidebar`, 新規 Settings モーダル、`index.css`（テーマ変数）、`TerminalView`（xterm theme）、`AppConfig` 型
- Backend: `internal/config` の Config / Defaults / Validate / PATCH、関連テスト
- API: `GET`/`PATCH /api/config` に `color_scheme` フィールド追加（後方互換: 未設定時は `system` または現行相当のデフォルト）
