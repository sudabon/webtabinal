## Context

WebTabinal はダーク固定の CSS 変数（`web/src/index.css`）と、xterm のハードコードされたダークテーマ（`TerminalView`）で描画している。設定 UI はなく、既存のユーザー向け永続設定は `PATCH /api/config`（例: `sidebar_width`）経由。

本変更では設定モーダル枠と、最初の設定項目としてカラースキーム（light / dark / system）を追加する。

## Goals / Non-Goals

**Goals:**

- サイドバーから開ける設定モーダル（左メニュー / 右パネル）を用意する
- 初期メニューは「外観」のみ。他カテゴリは枠だけ用意し中身は後続
- `color_scheme` をサーバー設定に保存し、変更は即適用・即保存
- UI 全体と xterm テーマを解決済みテーマ（light/dark）に連動させる
- `system` 時は `prefers-color-scheme` に追従し、OS 変更も反映する

**Non-Goals:**

- フォント・通知など既存設定のモーダルへの移行
- カスタムカラーパレットやテーマエディタ
- 保存ボタン付きの下書き編集フロー
- 複数ブラウザ間以外の同期手段（設定ファイル共有以外）

## Decisions

### 1. 永続化はサーバー `AppConfig.color_scheme`

- **選択**: `color_scheme: "light" | "dark" | "system"` を `internal/config` と `/api/config` に追加
- **デフォルト**: `"system"`（既存ユーザーも OS 追従。見た目が変わる可能性ありだが、明示設定がない状態として妥当）
- **代替案**: `localStorage` のみ → 他設定と保存場所が分裂するため不採用

### 2. 解決済みテーマの適用

- ドキュメント root に `data-theme="light|dark"` をセット
- CSS は `:root` / `[data-theme="light"]` で変数を定義。`color-scheme` も合わせる
- `system` は JS で `matchMedia('(prefers-color-scheme: dark)')` を監視し、解決結果を `data-theme` に反映
- xterm `theme` も解決済みテーマに応じて更新（ターミナル生成後の変更にも追従）

### 3. 設定モーダル UX

- 入口: サイドバー下部「新規タブ」の下に「設定」
- レイアウト: 左ナビ + 右コンテンツ
- 左ナビ初期: 「外観」アクティブ。将来用の空枠は不要なら「外観」のみでよい（プレースホルダメニューは出さない）
- 右: ライト / ダーク / 自動 の選択 UI
- 変更時に `patchConfig({ color_scheme })` を呼び、成功時にローカル config state とテーマ適用を更新
- 閉じる: 「キャンセル」ボタン + Esc + 背景クリック（いずれも破棄ではなく単に閉じる。即時保存済み）

### 4. コンポーネント分割

- `SettingsModal`（シェル: 開閉、左ナビ、閉じる）
- `AppearanceSettings`（テーマ選択）
- テーマ適用ロジックは小さな hook / util（`useColorScheme(config)`）に集約し、App から呼び出す

### 5. ライトパレット

- 既存ダーク変数の対になるライト変数を定義（背景・サイドバー・ボーダー・テキスト・アクセント・danger・active）
- toast などハードコード色はテーマ変数化、または light/dark 両方で読める色に寄せる
- タブ hover など `:root` 直書き hex も変数へ寄せる

## Risks / Trade-offs

- [デフォルト `system` で既存ダーク固定ユーザーの見た目が変わる] → デフォルトを `dark` にする選択肢あり。本設計は `system`。必要なら実装前に `dark` へ変更可
- [設定 PATCH 失敗時に UI だけ先行して食い違う] → 失敗時は選択をロールバックし、既存 toast でエラー表示
- [xterm テーマ切替で描画フラッシュ] → 許容。必要なら後で最適化
- [設定モーダルに他項目がなく「枠だけ」感] → 意図どおり。外観のみで十分な密度にする

## Migration Plan

1. 設定に `color_scheme` を追加（未指定ファイルは Defaults で `system`）
2. フロントをデプロイ/ビルドし、テーマ適用と設定 UI を有効化
3. ロールバック: フィールドを無視すれば旧 UI（ダーク固定）に戻せる。設定値は無害な余剰 JSON

## Open Questions

- なし（デフォルトを `system` にする点のみ、実装時に `dark` へ変更要求があれば追随）
