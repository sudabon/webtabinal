# PR #5 レビュー候補

## Page 1

### C-01
- file:line: desktop/scripts/generate-icon.swift:53
- 観点: correctness
- 懸念: 生成する `.iconset` のファイル構成を `iconutil` が受理しない
- なぜ怪しいか: 追加スクリプトをそのまま実行すると `Invalid Iconset` で終了し、`make desktop` が必ず失敗する。
- 確信度: 高
- 出典: skill/correctness

### C-02
- file:line: desktop/scripts/build-app.sh:21
- 観点: compatibility
- 懸念: `swiftc` の deployment target が未指定で `LSMinimumSystemVersion=13.0` と実バイナリが一致しない
- なぜ怪しいか: 現環境では生成バイナリの `LC_BUILD_VERSION minos` が 26.0 になり、plist が宣言する macOS 13 では起動できない。
- 確信度: 高
- 出典: skill/correctness

### C-03
- file:line: desktop/Sources/main.swift:43
- 観点: security
- 懸念: TCP 接続できるだけで WebTabinal デーモンとみなし、そのポートの内容を WKWebView に読み込む
- なぜ怪しいか: 設定ポートを別のローカルサービスが使用中でも spawn を省略し、そのサービスへデスクトップ用スクリプトブリッジを注入して表示する。
- 確信度: 高
- 出典: skill/security, skill/correctness

### C-04
- file:line: internal/server/server.go:54
- 観点: correctness
- 懸念: `/api/config` から HTTP 応答が返ればステータスや内容を問わず WebTabinal と判定する
- なぜ怪しいか: 401、403、404 やリダイレクト先の応答でも `true` になり、無関係な HTTP サービスがいるだけで `serve` が成功扱いで終了する。
- 確信度: 高
- 出典: skill/correctness, skill/security

### C-05
- file:line: desktop/Sources/main.swift:174
- 観点: compatibility
- 懸念: 既存設定に `port` がない、または 0 の場合の扱いが Go 側と一致しない
- なぜ怪しいか: Go の `config.Store` は欠落値・0を既定値 8642 に補完するが、ネイティブアプリは起動エラーとして終了する。
- 確信度: 高
- 出典: skill/correctness, skill/type-design

### C-06
- file:line: web/src/components/TerminalView.tsx:42
- 観点: security
- 懸念: `WebLinksAddon` の既定リンク処理が持つ opener 切り離しを失っている
- なぜ怪しいか: 既定実装は空ウィンドウを作って `opener = null` にしてから遷移するが、新しいハンドラは URL を直接 `_blank` で開く。
- 確信度: 高
- 出典: skill/security

### C-07
- file:line: internal/launchd/launchd.go:50
- 観点: correctness
- 懸念: sidecar が先に listen 中だと LaunchAgent が成功終了し、その sidecar が後で停止しても再起動されない
- なぜ怪しいか: `SuccessfulExit=false` は成功終了したジョブを保持しないため、インストール済み LaunchAgent の KeepAlive が以後のデーモン停止を回復できない状態になる。
- 確信度: 高
- 出典: skill/correctness

### C-08
- file:line: cmd/webtabinal/main.go:111
- 観点: compatibility
- 懸念: 旧版の無条件 `KeepAlive=true` plist を使う既存ユーザーで成功終了が再起動ループを起こす
- なぜ怪しいか: バイナリだけ更新され、別の WebTabinal がポートを占有している状態では、旧 LaunchAgent が exit 0 の新バイナリを繰り返し起動する。
- 確信度: 高
- 出典: skill/correctness, skill/comment-accuracy

### C-09
- file:line: internal/server/server.go:66
- 観点: correctness
- 懸念: probe と bind の間の競合で同時起動の片方が通常の bind エラーになる
- なぜ怪しいか: 2プロセスが同時に probe すると両方 false を得られ、その後の `ListenAndServe` で負けた側は `ErrAlreadyRunning` ではなく `address already in use` を返す。
- 確信度: 高
- 出典: skill/correctness

### C-10
- file:line: internal/server/server_test.go:210
- 観点: test coverage
- 懸念: 既存 HTTP サービスが WebTabinal かどうかを識別するテストがない
- なぜ怪しいか: 現テストの `httptest.Server` は Host 検査で 403 を返しても成功判定されるため、任意の HTTP 応答を受理する実装を検出できない。
- 確信度: 高
- 出典: skill/test-coverage

### C-11
- file:line: desktop/Sources/main.swift:22
- 観点: test coverage
- 懸念: 新規ネイティブ起動シーケンスに自動テストがない
- なぜ怪しいか: config 読み取り、既存デーモン識別、spawn、タイムアウト、window close という高リスク分岐が393行追加されたが、対応するテストターゲットがない。
- 確信度: 高
- 出典: skill/test-coverage

### C-12
- file:line: desktop/Sources/main.swift:245
- 観点: compatibility
- 懸念: 実行時に `/usr/bin/python3` が存在することを前提としている
- なぜ怪しいか: `.app` 自体には Python を同梱せず、ビルド後のアプリを Command Line Tools のない Mac にコピーすると cold start が失敗し得る。
- 確信度: 中
- 出典: skill/correctness

### C-13
- file:line: desktop/Sources/main.swift:295
- 観点: silent failures
- 懸念: 正常に起こり得るキャンセル済み navigation まで致命的なロード失敗として扱う
- なぜ怪しいか: WebKit の `NSURLErrorCancelled` は遷移の差し替え等でも発生し得るが、現在はアラート後にアプリ全体を終了する。
- 確信度: 中
- 出典: skill/silent-failures, skill/correctness

### C-14
- file:line: desktop/Sources/main.swift:55
- 観点: test coverage
- 懸念: ネイティブのタイトルバー close が既存 `beforeunload` 確認を維持することを検証していない
- なぜ怪しいか: `NSWindow` を閉じると直ちにアプリ終了する構成だが、実行中セッションの確認ダイアログが WKWebView 破棄時にも発火する保証を示すテストがない。
- 確信度: 中
- 出典: skill/test-coverage, skill/correctness

### C-15
- file:line: desktop/Sources/main.swift:286
- 観点: correctness
- 懸念: Python 文字列リテラルのエスケープが改行や制御文字を扱わない
- なぜ怪しいか: アプリ配置パスやホームパスに改行等が含まれると、生成される `python3 -c` スクリプトが構文エラーまたは別内容になる。
- 確信度: 中
- 出典: skill/correctness, skill/security

### C-16
- file:line: desktop/Sources/main.swift:369
- 観点: silent failures
- 懸念: 外部 URL オープンの失敗を無視している
- なぜ怪しいか: `NSWorkspace.shared.open` の Bool 戻り値を捨てるため、既定ブラウザが URL を処理できなくてもユーザーには何も伝わらない。
- 確信度: 中
- 出典: skill/silent-failures

### C-17
- file:line: desktop/scripts/build-app.sh:38
- 観点: silent failures
- 懸念: コード署名失敗後もビルド成功として終了する
- なぜ怪しいか: sidecar または app bundle の署名に失敗しても exit 0 と `built` を返し、実際には Gatekeeper が起動を拒否する成果物を成功扱いし得る。
- 確信度: 高
- 出典: skill/silent-failures

### C-18
- file:line: desktop/Sources/main.swift:43
- 観点: compatibility
- 懸念: 更新後の `.app` が常駐中の旧 sidecar を無条件に再利用する
- なぜ怪しいか: デーモンを window close 後も残すため、アプリを更新して再度開いても旧バイナリの埋め込み UI と API が使われ続け、バージョン不整合が解消されない。
- 確信度: 中
- 出典: skill/correctness, skill/type-design

### C-19
- file:line: internal/server/server.go:67
- 観点: comment accuracy
- 懸念: ログは「successfully」と述べる一方、`Server.Run` / `ListenAndServe` は非 nil エラーを返す
- なぜ怪しいか: CLI 層だけが sentinel を握りつぶすため、サーバーパッケージの直接利用者には成功ログとエラー戻り値が矛盾する。
- 確信度: 高
- 出典: skill/comment-accuracy, skill/type-design

### C-20
- file:line: desktop/Sources/main.swift:20
- 観点: simplification
- 懸念: `logPath` と空の `windowWillClose` が実際のライフサイクル制御をしていない
- なぜ怪しいか: `logPath` は代入後に参照されず、空 callback もデーモン維持には寄与しないため、意図を示す以上の不要な状態とフックになっている。
- 確信度: 高
- 出典: skill/simplification, skill/comment-accuracy

<!-- 列挙完了: 合計20件 -->
