# PR #5 コメント案（未投稿）

### 1. [Must Fix] `desktop/scripts/generate-icon.swift:53`

この iconset の生成方法では `iconutil` が `Invalid Iconset` を返すため、`make desktop` が必ず失敗します。実際に PR head のスクリプトを `web/public/icon.svg` に対して実行して再現しました。

故障シナリオ: `make desktop` を実行する → AppIcon 生成で終了し、`.app` が完成しない。

16/32/128/256/512px と、それぞれ iconutil が要求する @2x 名だけを生成する構成に直し、スクリプト単体で `.icns` が作れることを確認してください。

### 2. [Must Fix] `desktop/scripts/build-app.sh:21`

`swiftc` に deployment target がないため、生成バイナリの最低 OS がビルドホストに引き上げられます。現環境では `vtool -show-build` が `minos 26.0` を示しましたが、Info.plist は macOS 13.0 対応を宣言しています。

故障シナリオ: macOS 26 でビルドした `.app` を macOS 13 で開く → plist 上は対応しているのに実行ファイルをロードできない。

ホスト architecture を使った `-target <arch>-apple-macosx13.0` を指定し、生成物の load command も 13.0 になっていることを検証してください。

### 3. [Must Fix] `desktop/Sources/main.swift:43`

`isListening` が TCP connect の成功しか見ていないため、設定ポートを使う任意のローカルサービスを WebTabinal と誤認して、その内容をデスクトップ WKWebView に読み込みます。

故障シナリオ: 別サービスが設定ポートで listen 中に `.app` を開く → sidecar が起動せず、別サービスのページが WebTabinal として表示される。

公開 API は変えず、既存 `/api/config` の未認証応答と WebTabinal 固有のセキュリティヘッダー等を確認してから「既存 daemon」と判定してください。

### 4. [Must Fix] `internal/server/server.go:54`

Go 側の probe も、`/api/config` から HTTP 応答さえ返れば status/header/body を問わず true になります。403/404 や redirect 先の応答でも `ErrAlreadyRunning` になり、CLI は成功終了します。

故障シナリオ: 別 HTTP server が設定ポートを使用中に `webtabinal serve` を実行する → WebTabinal が起動していないのに exit 0 になる。

redirect を追わず、現行 WebTabinal の未認証 status と固有ヘッダーを検証した場合だけ `ErrAlreadyRunning` にしてください。

### 5. [Must Fix] `desktop/Sources/main.swift:174`

config の `port` 欠落/0に対する挙動が Go 側と一致しません。Go の `applyDefaults` は 8642 を補完しますが、ネイティブアプリは Invalid port で終了します。

故障シナリオ: 旧 config に `port` がない、または 0 の状態で `.app` を開く → CLI なら起動できる構成でもネイティブ入口だけ失敗する。

key 欠落または数値 0 は `defaultPort` とし、負数・上限超過・非整数だけをエラーにしてください。

### 6. [Should Fix] `web/src/components/TerminalView.tsx:42`

カスタム `WebLinksAddon` handler により、addon の既定実装が行っていた `window.opener` の切り離しが失われています。

故障シナリオ: ブラウザ/PWA で攻撃者管理の端末リンクを開く → 開いたページが opener を保持し、元の WebTabinal ウィンドウを別 URL へ遷移させ得る。

WKWebView の外部ブラウザ連携は維持しつつ `noopener` を明示するか、デスクトップ時だけカスタム handler を使い、通常ブラウザでは addon の安全な既定 handler を使ってください。

### 7. [Should Fix] `internal/server/server.go:66`

既存 daemon の probe と実際の bind が原子的でないため、同時起動時には片方が通常の `address already in use` で失敗します。

故障シナリオ: desktop app と LaunchAgent が同時に `serve` を開始し、双方が未使用を観測する → bind で負けた側が idempotent success ではなく非ゼロ終了する。

`EADDRINUSE` の場合に WebTabinal 固有 probe を再実行し、先発 daemon を確認できた場合だけ `ErrAlreadyRunning` へ正規化してください。

### 8. [Should Fix] `internal/server/server_test.go:210`

現在のテストは、WebTabinal handler が Host 不一致で返した 403 すら「稼働中」として受理するため、任意 HTTP server の誤認を検出できません。

故障シナリオ: `/api/config` に 404/403 を返す別 HTTP server を誤認する実装が入る → テストは全て通る一方、CLI は何も起動せず成功終了する。

正しい WebTabinal シグネチャ、404 server、redirect server、および bind race 後の再判定を対象にした回帰テストを追加してください。

### 9. [Should Fix] `desktop/Sources/main.swift:245`

sidecar の detach を `/usr/bin/python3` に依存させていますが、Python は app bundle に含まれず、対応 macOS の標準ランタイムとして契約されていません。

故障シナリオ: ビルド済み `.app` を Xcode/Command Line Tools のない macOS 13+ 環境で cold start する → Python を実行できず daemon が起動しない。

Darwin の `posix_spawn` と session detach 相当を使うなど、Python なしで sidecar を起動し、既存の stdout/stderr ログ接続を維持してください。
