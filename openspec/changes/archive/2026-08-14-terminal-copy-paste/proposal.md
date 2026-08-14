## Why

ターミナルで Cmd+C / Cmd+V が効かない。xterm は canvas / WebGL 上で選択しておりブラウザの標準コピーに乗れず、デスクトップの WKWebView は Edit メニューもなく Command キーを飲み込みやすい。選択テキストのコピーとクリップボードからのペーストは日常操作なので、ブラウザと `.app` の両方で macOS 端末と同じショートカットに揃える。

## What Changes

- ターミナルにフォーカスがあるとき、Cmd+C は選択があればクリップボードへコピーする。選択がなければ何もしない（Ctrl+C の割り込みは送らない）
- ターミナルにフォーカスがあるとき、Cmd+V はクリップボードを PTY へペーストする
- Ctrl+C は現行どおり割り込み（ETX）のまま
- 設定・メモなど通常のテキストフィールドでは、ブラウザ／OS の標準コピー・ペーストを妨げない
- デスクトップアプリに Edit メニュー（コピー / ペースト）を追加し、WKWebView でも同じ操作ができるようにする
- `copy_on_select` の既定と挙動は変えない

## Capabilities

### New Capabilities

- （なし）

### Modified Capabilities

- `terminal-ui`: Cmd+C で選択をコピー、Cmd+V でペーストすることを要件にする（現行 spec の「Cmd+C copies when there is a selection」を実装可能な形に具体化する）
- `desktop-shell`: ネイティブ Edit メニューと、WKWebView がクリップボードを読めない場合のペースト経路を要件にする

## Impact

- Frontend: `TerminalView` のキー処理、xterm 選択のコピー、`term.paste`、テキストフィールドとのフォーカス分岐、関連テスト
- Desktop: `setupMainMenu` に Edit メニュー、必要なら `NSPasteboard` と JS ブリッジ（既存 `webkit.messageHandlers.webtabinal` を拡張）
- Backend / sessions / config API: 変更なし
