## Why

起動シェルは `config.json` の `shell`（デフォルト `/bin/zsh`）として既に保存されているが、設定 UI からは変えられない。bash など別シェルを使いたいときにファイルを直接編集する必要がある。

## What Changes

- 設定モーダルに「一般」カテゴリを追加する
- 起動シェルを絶対パスのテキスト入力で編集できるようにする
- 確定はフォーカスアウトまたは Enter。既存どおり保存ボタンは出さない
- 無効なパス（相対パス・未存在・非実行可能）はサーバが拒否し、UI は直前の有効値に戻す
- 変更はこれから作るセッション（新規タブ・複製・終了後の restart）にだけ効く。開いているタブは再生成まで今のシェルのまま
- バックエンドの `shell` フィールドとバリデーションは既存のものを使う（API 契約の追加なし）

## Capabilities

### New Capabilities

- （なし）

### Modified Capabilities

- `settings-ui`: 「一般」カテゴリと起動シェルのパス入力を追加する。外観カテゴリは残し、モーダルを開いたときの初期選択は外観のまま
- `session-pty`: 設定された `shell` はセッション生成時点で適用されること、既存セッションは巻き直さないことを明示する

## Impact

- Frontend: `SettingsModal` のカテゴリ切替、新規一般ペイン（パス入力）、`App` からの `config.shell` 読み書き、入力欄スタイル、関連テスト
- Backend: 既存の `GET`/`PATCH /api/config` と `internal/config` の `shell` バリデーションを利用。新規エンドポイントなし
- Sessions: `Manager.Create` は既に `cfg.Shell` を読む。開いている PTY の付け替えはしない
- Shell integration: zsh 以外は現行どおり注入せず、未統合フォールバックのまま（本 change では bash 統合は作らない）
