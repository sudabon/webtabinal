# PRレビュー指摘の修正依頼

以下のPRレビュー指摘を修正してください。

## 制約
- 列挙した指摘のみ修正し、それ以外の変更を行わないこと
- リファクタリングや無関係な整形を追加しないこと
- 後方互換性を維持すること
- 公開 API を変更しないこと
- コミット・push は行わないこと

## 指摘一覧

### 1. [Must Fix] desktop/scripts/generate-icon.swift:53
- 指摘: 生成する `.iconset` の構成が不正で、`iconutil` が `Invalid Iconset` を返すため `make desktop` が必ず失敗する。
- 故障シナリオ: `make desktop` でアイコン生成を実行する → AppIcon 生成で終了し、`.app` が完成しない。
- 最小修正案: iconutil が要求する 16/32/128/256/512 と各 @2x の正規ファイル名だけを生成し、スクリプト単体実行で `.icns` 作成まで確認する。

### 2. [Must Fix] desktop/scripts/build-app.sh:21
- 指摘: `swiftc` の deployment target が未指定で、生成物の最低 OS が Info.plist の macOS 13 宣言と一致しない。
- 故障シナリオ: 新しい macOS でビルドした `.app` を macOS 13 で開く → 実行ファイルの `minos` が新しいため起動できない。
- 最小修正案: ホスト architecture を保った `-target <arch>-apple-macosx13.0` を指定し、生成物の最低 OS を検証できるようにする。

### 3. [Must Fix] desktop/Sources/main.swift:43
- 指摘: TCP connect の成功だけで WebTabinal daemon と判定し、別のローカルサービスを WKWebView に読み込む。
- 故障シナリオ: 設定ポートで別サービスが listen 中に `.app` を開く → sidecar を起動せず、別サービスを WebTabinal として表示する。
- 最小修正案: 公開 API を追加・変更せず、既存 `/api/config` の未認証 status と WebTabinal 固有セキュリティヘッダー等を同一ホスト上で検証してから再利用する。

### 4. [Must Fix] internal/server/server.go:54
- 指摘: `/api/config` の任意 HTTP 応答を WebTabinal と誤認し、WebTabinal がいないのに CLI が成功終了する。
- 故障シナリオ: 別 HTTP server が設定ポートを使用中に `webtabinal serve` を実行する → `ErrAlreadyRunning` が返って exit 0 だが WebTabinal は起動しない。
- 最小修正案: redirect を追わず、現行 WebTabinal の未認証 status と固有セキュリティヘッダーを検証した場合だけ `ErrAlreadyRunning` にする。

### 5. [Must Fix] desktop/Sources/main.swift:174
- 指摘: `port` 欠落または 0 の既存 config を Swift だけ拒否し、Go の既定値補完と互換でない。
- 故障シナリオ: 旧 config に `port` がない、または 0 の状態で `.app` を開く → CLI なら 8642 で起動できるのに native app は Invalid port で終了する。
- 最小修正案: key 欠落または数値 0 は `defaultPort` として扱い、負数・65535超・非整数だけを invalid とする。

### 6. [Should Fix] web/src/components/TerminalView.tsx:42
- 指摘: カスタム `WebLinksAddon` handler が addon 既定実装の opener 分離を失わせる。
- 故障シナリオ: ブラウザ/PWA で攻撃者管理の端末リンクをクリックする → 開いたページが opener を保持し、元の WebTabinal ウィンドウを別 URL へ遷移させ得る。
- 最小修正案: native WebView の外部ブラウザ連携を維持しつつ `noopener` を明示するか、desktop 時だけ custom handler を使って通常ブラウザでは安全な既定 handler を保つ。

### 7. [Should Fix] internal/server/server.go:66
- 指摘: probe と bind の TOCTOU により、同時起動の片方が通常の bind error で非ゼロ終了する。
- 故障シナリオ: desktop app と LaunchAgent が同時に開始して双方が未使用を観測する → bind で負けた側が `address already in use` になる。
- 最小修正案: bind の `EADDRINUSE` 発生時に WebTabinal 固有 probe を再実行し、先発を確認できた場合だけ `ErrAlreadyRunning` に正規化する。

### 8. [Should Fix] internal/server/server_test.go:210
- 指摘: WebTabinal identity、無関係な HTTP server、redirect、および bind race 後の再判定を検証するテストがない。
- 故障シナリオ: 別 HTTP server を誤認する実装でも現テストが全て通り、CLI が何も起動せず exit 0 になる退行を検出できない。
- 最小修正案: 正しい WebTabinal シグネチャ、404 server、redirect server、bind race 後の再判定を対象とする回帰テストを追加する。

### 9. [Should Fix] desktop/Sources/main.swift:245
- 指摘: sidecar の detach が app bundle にない `/usr/bin/python3` に依存する。
- 故障シナリオ: ビルド済み `.app` を Xcode/Command Line Tools のない対応 macOS 13+ 環境で cold start する → Python を実行できず daemon が起動しない。
- 最小修正案: Darwin の `posix_spawn` と session detach 相当を用い、Python なしで sidecar を起動しつつ既存の stdout/stderr ログ接続を維持する。
