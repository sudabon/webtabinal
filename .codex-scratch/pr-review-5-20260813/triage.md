# PR #5 レビュー候補の精査分類

## Must Fix

### C-01 [Must Fix]
- file:line: desktop/scripts/generate-icon.swift:53
- 指摘: 生成する `.iconset` の構成が不正で、デスクトップアプリをビルドできない。
- 故障シナリオ: `make desktop` でアイコン生成を実行する → `iconutil` が `Invalid Iconset` を返してビルドが必ず失敗する。
- 根拠: 追加されたスクリプトを PR head 上で実行して同じエラーを再現した。macOS の iconset にない 64px/1024px の基底名等も生成している。
- 反証: Swift の型検査と plist 検査は通るが、成果物作成に必須の `iconutil` が失敗するため回避にならない。
- 最小修正案: iconutil が要求する 16/32/128/256/512 と各 @2x の正規ファイル名だけを生成し、スクリプト単体実行で `.icns` 作成まで確認する。
- 出典: skill/correctness

### C-02 [Must Fix]
- file:line: desktop/scripts/build-app.sh:21
- 指摘: ネイティブ実行ファイルの deployment target が plist の macOS 13 宣言と一致しない。
- 故障シナリオ: macOS 26 上で現スクリプトを使ってビルドし、その `.app` を macOS 13 で開く → 実行ファイルの `minos 26.0` により起動できない。
- 根拠: 同一 `swiftc` 引数で生成したバイナリを `vtool -show-build` で確認すると `minos 26.0` だった一方、Info.plist は `LSMinimumSystemVersion=13.0` を宣言している。
- 反証: ビルドした同じ Mac だけで使うなら直ちに壊れないが、明示された最低対応 OS と成果物の契約に反する。
- 最小修正案: ホスト architecture を保ったまま `swiftc -target <arch>-apple-macosx13.0` を指定し、生成後に load command の最低 OS を検証する。
- 出典: skill/correctness

### C-03 [Must Fix]
- file:line: desktop/Sources/main.swift:43
- 指摘: ネイティブアプリが TCP 接続だけで WebTabinal の稼働を判定し、無関係なローカルサービスを表示する。
- 故障シナリオ: 設定ポートで別の TCP/HTTP サービスが listen 中に `.app` を開く → sidecar を起動せず、そのサービスをデスクトップ用 WKWebView に読み込む。
- 根拠: `isListening` は `connect(2)` の成否しか見ず、HTTP status、WebTabinal 固有のヘッダー、本文を一切検証しない。
- 反証: 通常は既定ポートを WebTabinal だけが使うが、ポート競合は明示的に扱うべき起動条件であり、任意サービスを成功扱いできない。
- 最小修正案: 既存の `/api/config` 未認証応答とセキュリティヘッダーなど、現行 API を変更せず確認できる WebTabinal 固有シグネチャを同一ホスト上で検証してから再利用する。
- 出典: skill/security, skill/correctness

### C-04 [Must Fix]
- file:line: internal/server/server.go:54
- 指摘: Go 側の既存デーモン検出も任意の HTTP 応答を WebTabinal と誤認する。
- 故障シナリオ: 設定ポートの別 HTTP サーバーが `/api/config` に 404 等を返す状態で `webtabinal serve` を実行する → `ErrAlreadyRunning` が返り、CLI は exit 0 だが WebTabinal は起動しない。
- 根拠: `http.Client.Get` が transport error を返さなければ status、header、body を見ずに true を返す。既存テストも Host 不一致の 403 を成功判定している。
- 反証: plain TCP listener は false になるが、HTTP を話すだけの無関係なサービスは除外できない。リダイレクトも既定で追従する。
- 最小修正案: リダイレクトを追わず、現行 WebTabinal が返す未認証 status と固有セキュリティヘッダーを検証してから `ErrAlreadyRunning` にする。
- 出典: skill/correctness, skill/security

### C-05 [Must Fix]
- file:line: desktop/Sources/main.swift:174
- 指摘: `port` 欠落または 0 の既存 config に対する互換性が Go デーモンと一致しない。
- 故障シナリオ: 既存 `config.json` に `port` がない、または 0 が保存されている状態で `.app` を開く → Go は 8642 を補完して起動できるのに、アプリは Invalid port で終了する。
- 根拠: `config.Store.applyDefaults` は `Port == 0` を 8642 にする一方、Swift は `json["port"] as? Int` と 1...65535 を必須にする。
- 反証: 現行バージョンが生成した config には通常 port があるが、後方互換用の Go の既定値処理とネイティブ入口が分岐している。
- 最小修正案: key 欠落または数値 0 は `defaultPort` として扱い、負数・65535超・非整数だけを invalid とする。
- 出典: skill/correctness, skill/type-design

## Should Fix

### C-06 [Should Fix]
- file:line: web/src/components/TerminalView.tsx:42
- 指摘: カスタムリンクハンドラが `WebLinksAddon` 既定実装の opener 分離を後退させる。
- 故障シナリオ: 通常ブラウザ/PWA で端末出力中の攻撃者管理 URL をクリックする → 開いたページが `window.opener` を保持でき、元の WebTabinal ウィンドウを別 URL へ遷移させ得る。
- 根拠: インストール済み addon の既定ハンドラは空ウィンドウを作り `opener=null` にした後で遷移するが、新コードは `window.open(uri, '_blank')` を直接呼ぶ。
- 反証: 一部ブラウザは `_blank` を暗黙に noopener として扱う場合があるが、ライブラリが明示的に防御していた挙動を全対応環境で保証できない。
- 最小修正案: ネイティブ WebView の外部オープンを維持しつつ `noopener` を明示するか、デスクトップ時だけカスタム処理を使いブラウザでは addon の既定処理を保つ。
- 出典: skill/security

### C-09 [Should Fix]
- file:line: internal/server/server.go:66
- 指摘: probe と bind の TOCTOU により同時起動を idempotent に扱えない。
- 故障シナリオ: 2つの `webtabinal serve` が同時に開始し、双方が preflight で未使用を観測する → bind で負けた側が通常の `address already in use` を返して非ゼロ終了する。
- 根拠: 既存確認と `ListenAndServe` の bind は原子的でなく、bind error 後に WebTabinal の稼働を再判定する処理がない。
- 反証: 起動時刻が十分ずれれば後発 probe が先発を見つけるが、デスクトップアプリと LaunchAgent の同時起動がまさに競合を生む。
- 最小修正案: bind の `EADDRINUSE` 発生時に WebTabinal 固有 probe を再実行し、先発が確認できた場合だけ `ErrAlreadyRunning` へ正規化する。
- 出典: skill/correctness

### C-10 [Should Fix]
- file:line: internal/server/server_test.go:210
- 指摘: WebTabinal 固有判定と無関係な HTTP サービスの回帰テストが不足している。
- 故障シナリオ: `/api/config` に 404/403 を返す別 HTTP サービスを実装が誤認する → 現在のテスト一式は成功し、CLI が何も起動せず exit 0 になる退行を検出できない。
- 根拠: 現テストの handler 自身が Host 不一致で 403 を返す構成なのに `LoopbackListening` の true を期待している。
- 反証: transport error と plain TCP listener は検証されているが、問題の中心である HTTP identity は検証されていない。
- 最小修正案: 正しい WebTabinal シグネチャ、404を返す HTTP server、redirect server、bind race 後の再判定を対象とするテストを追加する。
- 出典: skill/test-coverage

### C-12 [Should Fix]
- file:line: desktop/Sources/main.swift:245
- 指摘: `.app` の cold start が Xcode Command Line Tools 由来の `/usr/bin/python3` に依存する。
- 故障シナリオ: ビルド済み `.app` を Xcode/Command Line Tools のない対応 macOS 13+ 環境へコピーして初回起動する → `/usr/bin/python3` を実行できず sidecar が起動しない。
- 根拠: Python は app bundle に同梱されず、Apple の資料上も Command Line Tools 側のランタイムである。実行環境の依存として宣言も検査もされていない。
- 反証: 同じ開発 Mac だけで使う場合は swiftc を使うため Python も存在する可能性が高いが、生成物の `LSMinimumSystemVersion` 契約には開発ツール要件がない。
- 最小修正案: Python を介さず Darwin の `posix_spawn`/session detach 相当で sidecar を起動し、stdout/stderr を同じログへ接続する。
- 出典: skill/correctness

## Consider

### C-07 [Consider]
- file:line: internal/launchd/launchd.go:50
- 指摘: sidecar と LaunchAgent の所有権移譲後に KeepAlive が途切れる可能性がある。
- 故障シナリオ: 該当なし
- 根拠: `SuccessfulExit=false` は別 daemon 検出による exit 0 後は再起動条件を失い、後で sidecar が落ちても LaunchAgent は自動復帰しない。
- 反証: 正常なログイン順では LaunchAgent が先にポートを所有し、sidecar は起動されない。完全な解決は supervisor/socket activation 等の設計選択を伴う。
- 最小修正案: 「常駐の所有者」を LaunchAgent と sidecar のどちらにするか決め、必要なら launchd socket activation または専用 supervisor モードを別 change として設計する。
- 出典: skill/correctness

### C-08 [Consider]
- file:line: cmd/webtabinal/main.go:111
- 指摘: 既存の無条件 KeepAlive plist を新しい終了契約へ移行する仕組みがない。
- 故障シナリオ: 該当なし
- 根拠: 旧 plist がロードされたまま sidecar と競合すると、exit 0 でも launchd は再起動を続ける。
- 反証: 通常のアップグレードでは既存 LaunchAgent が既にポートを所有し続けるため、競合状態に入る窓は限定的。自動 plist 書換え・reload は外部状態変更を伴う。
- 最小修正案: アップグレード手順として再 install を明示するか、安全な plist バージョン検出と明示的 migration を別 change で定義する。
- 出典: skill/correctness, skill/comment-accuracy

### C-11 [Consider]
- file:line: desktop/Sources/main.swift:22
- 指摘: ネイティブ起動シーケンスの自動テスト基盤がない。
- 故障シナリオ: 該当なし
- 根拠: 今回、アイコン生成・deployment target・config 互換性の複数不具合が既存テストを通過している。
- 反証: AppKit/WKWebView の end-to-end テスト導入は今回の最小修正を超え得る。個別の pure function とビルド smoke test は小さく追加できる。
- 最小修正案: まず config/probe をテスト可能な pure helper に分離し、CI で Swift typecheck・icon generation・Mach-O minimum-version 検査を行う方針を検討する。
- 出典: skill/test-coverage

### C-13 [Consider]
- file:line: desktop/Sources/main.swift:295
- 指摘: `NSURLErrorCancelled` を含む全 navigation error を致命扱いしている。
- 故障シナリオ: 該当なし
- 根拠: WebKit は navigation 差し替え時にも cancellation を通知し得るため、一般には error code を分ける必要がある。
- 反証: 現実装は初期 URL を一度だけ load する SPA であり、正常操作から cancellation が発生する具体的経路を確認できなかった。
- 最小修正案: 実機ログで -999 が正常遷移時に発生するか確認し、確認できた場合だけ cancellation を無視する。
- 出典: skill/silent-failures, skill/correctness

### C-14 [Consider]
- file:line: desktop/Sources/main.swift:55
- 指摘: ネイティブ window close と `beforeunload` 確認の統合が未検証に見える。
- 故障シナリオ: 該当なし
- 根拠: NSWindow close は Web navigation と別経路であり、Web 側の handler が必ず走る保証をコードから確認できない。
- 反証: close 後も daemon/session は残るためデータ損失はなく、OpenSpec の主要要件は満たす可能性がある。実機手動検証済みとの tasks 記載もある。
- 最小修正案: 実行中 session を用いた titlebar close の手動検証結果を明文化し、必要なら native 側で確認を仲介する。
- 出典: skill/test-coverage, skill/correctness

### C-15 [Consider]
- file:line: desktop/Sources/main.swift:286
- 指摘: 手書き Python literal が改行等の合法なパス文字を扱えない。
- 故障シナリオ: 該当なし
- 根拠: バックスラッシュと引用符しか escape しないため、改行を含む bundle/home path は生成スクリプトを壊す。
- 反証: 通常の macOS ユーザーホームと `/Applications` 配置では該当せず、C-12 の Python 除去で同時に消える。
- 最小修正案: Python 経路を残す場合だけ、JSON encoder 等で正しい文字列 literal を生成する。
- 出典: skill/correctness, skill/security

### C-17 [Consider]
- file:line: desktop/scripts/build-app.sh:38
- 指摘: 署名失敗後も部分的に利用可能な bundle を成功扱いする方針になっている。
- 故障シナリオ: 該当なし
- 根拠: `codesign` failure を warning に落として最終 exit status 0 とする。
- 反証: warning は明示されており silent ではない。個人ローカル用途では未署名 bundle を明示操作で起動できる場合もあるため、常に壊れるとは言えない。
- 最小修正案: 配布契約を決め、署名を必須とするなら fail-fast、任意なら README に未署名時の制約を明記する。
- 出典: skill/silent-failures

### C-18 [Consider]
- file:line: desktop/Sources/main.swift:43
- 指摘: 常駐 daemon と更新済み app bundle のバージョン整合性が定義されていない。
- 故障シナリオ: 該当なし
- 根拠: listen 中なら常に再利用するので、bundle 更新後も旧 daemon の埋め込み frontend/API が残る。
- 反証: 現在は同一バージョンの個人利用が前提で、daemon を残すこと自体が session 維持要件である。強制再起動は session を失う。
- 最小修正案: 将来の update 対応時に互換バージョン handshake と安全な再起動方針を別 change で定義する。
- 出典: skill/correctness, skill/type-design

## False Positive / Weak

### C-16 [False Positive / Weak]
- file:line: desktop/Sources/main.swift:369
- 指摘: `NSWorkspace.shared.open` の戻り値を無視している。
- 故障シナリオ: 該当なし
- 根拠: URL を処理できない場合に inline error は出ない。
- 反証: 現在の入口は xterm が認識した HTTP(S) URL に限られ、OS の標準ブラウザ処理へ委譲する best-effort UI として妥当。コアデータも失わない。
- 最小修正案: 修正不要。必要性が実測された場合のみ通知 UI を追加する。
- 出典: skill/silent-failures

### C-19 [False Positive / Weak]
- file:line: internal/server/server.go:67
- 指摘: 成功ログと sentinel error の見かけ上の不一致。
- 故障シナリオ: 該当なし
- 根拠: `Server.Run` 単体では non-nil sentinel を返す。
- 反証: package は `internal` で、実際の CLI caller は `errors.Is` で明示的に成功へ変換している。sentinel は制御フローを型安全に伝える意図として整合的。
- 最小修正案: 修正不要。誤解が実際に生じる場合だけ comment を補足する。
- 出典: skill/comment-accuracy, skill/type-design

### C-20 [False Positive / Weak]
- file:line: desktop/Sources/main.swift:20
- 指摘: 未使用 `logPath` と空の delegate callback がある。
- 故障シナリオ: 該当なし
- 根拠: 実行時挙動には寄与していない。
- 反証: 機能故障はなく、今回の Must/Should 修正と無関係な cleanup にすぎない。最小変更ルールでは対象外にすべき。
- 最小修正案: 修正不要。
- 出典: skill/simplification, skill/comment-accuracy
