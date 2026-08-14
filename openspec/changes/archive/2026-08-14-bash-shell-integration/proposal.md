## Why

左メニューのカレントディレクトリ・実行中コマンド・idle/running は、zsh の OSC シェル連携でのみライブ更新される。設定から bash（`/bin/bash` や `/opt/homebrew/bin/bash`）を選ぶと注入がスキップされ、`cd` してもサイドバーが変わらない。zsh と同等の体験を bash でも提供する。

## What Changes

- bash 起動時に、ユーザーの `~/.bashrc` 一行追加なしで OSC 統合を注入する（zsh の ZDOTDIR 注入と同趣旨）
- 注入スクリプトは既存と同じ OSC 7（CWD）、OSC 133 A/C/D（prompt/start/end）、OSC 9973（コマンド）を出す
- デーモンの OSC パーサ・state 配信・サイドバー表示は流用する（プロトコル追加なし）
- macOS 付属の `/bin/bash` 3.2 と Homebrew bash 5.x の両方で動く
- 設定の起動シェル hint を、zsh / bash ではライブ CWD が付く旨が分かる文言にする
- fish など bash/zsh 以外は対象外（現行どおり未統合フォールバック）

## Capabilities

### New Capabilities

- （なし）

### Modified Capabilities

- `shell-integration`: zsh 専用だった自動注入と OSC 発行を、basename が `bash` のシェルにも適用する。ユーザー rc への一行追加は不要
- `session-pty`: bash セッションの起動引数を、login 相当の初期化を保ったまま統合スクリプトが読める形にする（zsh の `-il` + ZDOTDIR は変えない）
- `settings-ui`: 起動シェル欄の説明を、zsh / bash ではサイドバーの CWD・コマンドがライブ更新されることに触れる

## Impact

- Backend: `internal/integration` に bash 用スクリプトと注入、`session.Create` の argv/env 分岐、cwd 相当の結合テスト
- Frontend: `GeneralSettings` の hint 文言のみ。API・WebSocket 契約の変更なし
- Docs: README のシェル連携を zsh 限定から bash を含む記述に更新
- 既存の zsh タブ・zsh 注入経路は維持する
