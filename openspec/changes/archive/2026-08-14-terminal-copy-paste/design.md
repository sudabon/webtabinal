## Context

xterm.js は canvas / WebGL で描画し、選択は DOM に乗らない。そのためブラウザの Cmd+C は空の選択をコピーする。`copy_on_select` はあるが既定オフで、キーによるコピー／ペーストは未実装。

デスクトップの `DesktopWebView` は Command キーを `NSApp.mainMenu` に転送して Cmd+Q を効かせている。メニューに Copy / Paste が無いため、Cmd+C / Cmd+V はどこにも届かないか、WKWebView に飲まれる。`navigator.clipboard.readText()` も WKWebView では拒否されやすい。

既存の `window.__WEBTABINAL_DESKTOP__` と `webkit.messageHandlers.webtabinal` を拡張して、ブラウザと `.app` で同じユーザー操作（Cmd+C / Cmd+V）を実現する。

## Goals / Non-Goals

**Goals:**

- ターミナルフォーカス時、Cmd+C で選択をクリップボードへコピーする
- ターミナルフォーカス時、Cmd+V でクリップボードを PTY へペーストする
- Ctrl+C は割り込みのまま
- 設定・メモなどのテキストフィールドでは標準のコピー／ペーストを維持する
- ブラウザ（通常タブ / PWA）と macOS `.app` の両方で動く

**Non-Goals:**

- Cmd+X（カット）、Cmd+A 全選択の新規実装（xterm の選択はそのまま）
- Windows / Linux 向け Ctrl+Shift+C などの別スキーム
- `copy_on_select` の既定変更や UI への露出
- 右クリックコンテキストメニューのコピー／ペースト
- クリップボード内容のサーバ送信や履歴

## Decisions

### 1. ショートカットは macOS 端末と同じ

- **選択**: Cmd+C = コピー、Cmd+V = ペースト、Ctrl+C = 割り込み
- **理由**: ユーザー要求と macOS Terminal / iTerm の習慣。Cmd+C を割り込みにすると誤操作でプロセスを殺す
- **選択なしの Cmd+C**: no-op（クリップボードを空で上書きしない、ETX も送らない）
- **代替案**: 選択なし Cmd+C を Ctrl+C 相当にする → 誤割り込みのリスクのため不採用

### 2. ブラウザは xterm のキーハンドラ + Clipboard API

- **選択**: `attachCustomKeyEventHandler`（または window `keydown`）で meta+C / meta+V を処理。コピーは `navigator.clipboard.writeText(term.getSelection())`、ペーストは `readText()` のあと `term.paste(text)`
- **テキストフィールド**: `input` / `textarea` / `contenteditable` が active ならインターセプトしない
- **IME**: composing 中は無視（メモ入力と同じ）
- **理由**: PWA / ブラウザではネイティブメニューが無い。Clipboard API はユーザー操作（キー）から呼べる
- **代替案**: hidden textarea の native copy に頼る → WebGL 選択が乗らないので不採用

### 3. デスクトップは Edit メニュー + NSPasteboard が正

- **選択**: メニューにコピー（⌘C）とペースト（⌘V）を追加する。`performKeyEquivalent` がメニューに渡す現行経路に乗る
- **コピー**: `evaluateJavaScript` でフロントの選択テキストを取り、`NSPasteboard.general` に書く。空なら何もしない
- **ペースト**: テキストフィールドフォーカスなら WKWebView の標準ペースト。ターミナルなら pasteboard の文字列を JS の `term.paste` に渡す
- **理由**: WKWebView は Command キーを飲み込み、`clipboard.readText` も不安定。メニュー経由なら OS ショートカットとメニュー操作の両方が同じ経路になる
- **代替案**: JS だけに任せる → キーが届かない／readText 失敗で `.app` だけ壊れるため不採用

### 4. フロントに小さなクリップボード facade を置く

- **選択**: ターミナルとテキストフィールドの分岐、選択テキストの取得、`term.paste` を `window` から呼べる薄い API にする（例: フォーカス種別、copy テキスト、paste）
- **ブラウザのキーハンドラ**と**Swift の evaluateJavaScript** が同じ関数を使う
- **理由**: 二つの入口で分岐ロジックを二重に持たない
- **テスト**: キー判定（meta+C/V、フィールド中は無視、選択なし copy は no-op）を xterm なしで単体テストする

### 5. 既存 message handler は必要なら読み取り専用に拡張

- **選択**: メニュー経路が主。キーイベントが JS に届いたデスクトップでもペーストできるよう、JS から pasteboard 読み取りを頼むメッセージを足してよい（Swift が pasteboard を読んで `paste` を evaluate し返す）
- **close の文字列メッセージ**は残す。新しい操作は辞書（`{ t: "clipboardRead" }` など）で足し、既存 `body == "close"` を壊さない
- **代替案**: コピーも JS→Swift に寄せる → メニューからの evaluate で足りるので必須にしない

## Risks / Trade-offs

- [WKWebView が Cmd+C をメニューに渡さず飲み込む] → Edit メニューを正とし、実装後に `.app` でキーとメニューの両方を確認する
- [巨大なクリップボードを paste すると PTY が詰まる] → xterm の `paste`（ブラケットペースト対応）に任せ、本 change では上限を設けない
- [設定モーダル表示中に Cmd+C がターミナルへ行く] → activeElement がフィールドならインターセプトしない。メニュー経路も JS のフォーカス種別に従う
- [ブラウザで Clipboard API が拒否される] → ユーザー操作起点で呼ぶ。失敗は既存 action toast に出さず、コピー／ペーストを静かに諦める（権限ダイアログを増やさない）

## Migration Plan

1. フロントのキー処理と facade を入れる。ブラウザ／PWA はこれで足りる
2. デスクトップに Edit メニューと pasteboard 経路を足して `.app` をビルドし直す
3. ロールバック: キーハンドラと Edit メニューを外せば旧挙動。設定ファイル変更なし

## Open Questions

- なし
