# コントリビューション

## フロントエンドの xterm.js beta

画像プロトコル（kitty graphics）は `@xterm/addon-image` の beta にだけ実装がある。その peer が `@xterm/xterm ^6.1.0-beta.301` のため、core と fit / search / web-links / webgl も beta の**完全固定バージョン**で入れている（`web/package.json` に `^` を付けない）。

stable の `@xterm/addon-image` に Kitty 実装が入った時点で、core とアドオンを揃えて stable へ戻す。それまでは `npm update` で xterm 系を拾わないこと。更新するときは 6 パッケージを同時に上げ、peer 警告が無いことを確認する。

デーモンの CSP は `script-src 'self' 'wasm-unsafe-eval'` を含む。ImageAddon の WASM デコーダに必要で、フル `unsafe-eval` は付けない。

## エージェント状態フィクスチャ

フィクスチャは `tests/fixtures/agents/<agent>/<version>/<scenario>/` に置き、`stream.raw`、`metadata.json`、`case.json` を含めます。`stream.raw` は元の PTY バイト列を保持します（事前レンダリングしたテキストは使いません）。新しいビルドを追加するとき、古いバージョンのディレクトリは削除しないでください。リポジトリサイズに関する文書化された判断がない限り、回帰テストのカバレッジとして残します。

ファイルあたりのサイズ上限は 512 KiB です。セッション全体のログより、短く独立したシナリオを優先してください。

### 録画

```bash
./scripts/record-agent-fixture.sh \
  --agent cursor-agent \
  --version 2026.08.11-e8db854 \
  --scenario idle \
  --rows 24 --cols 80 \
  --dest tests/fixtures/agents \
  -- agent
```

レコーダーは `script(1)`（macOS では BSD、Linux では util-linux）を使い、一時ディレクトリにキャプチャし、コマンドが成功してサイズチェックを通過したあとだけ正式な場所へ昇格します。既存の出力先は `--overwrite` を渡さない限り変更しません。失敗または中断した録画は、既存のフィクスチャを置き換えません。

このツールはトランスクリプトの秘匿情報を**自動ではマスキングしません**。制御シーケンスを保ったサニタイズが必要な場合は、レンダリング後の画面形状を維持してください（長さを変えない置換のみ）。

### 手動の秘匿情報レビュー

`"reviewed": true` を設定してコミットする前に、次を確認してください。

- 認証情報 / API トークン / Cookie
- 非公開のソース
- ユーザー名
- ホームディレクトリの絶対パス（`/Users/...`、`/home/...`）

CI は設定された認証情報パターンとホームディレクトリの絶対パスをスキャンし、**ファイル**を報告します（秘匿情報の値自体は報告しません）。これは人手によるレビューの代替にはなりません。

レビュー時は `webtabinal state snapshot <session-id>` に加え、`stream.raw` のエスケープ済みダンプまたは hex ダンプを使ってください。

### Golden リプレイ

`go test ./internal/agentdetect` は、本番の VT アダプタと検出器に対して、偽のクロックで全フィクスチャをリプレイします。`case.json` のステップはバイト範囲と仮想の `advance_ms` を指定するため、静止判定やデバウンスが実時間に依存しません。

### マニフェストの更新

同梱の状態パターンを変更するときは:

1. 対象ビルドそのもののフィクスチャを取得するか、既存のものを再利用する。
2. パターンはレビュー済みフィクスチャからのみ導出する。blocked の画面要素を推測で作らない。
3. `verified_against` を `tests/fixtures/agents/<id>/<version>/` と突き合わせる。
4. その状態のポジティブフィクスチャと、他状態のネガティブフィクスチャを実行する（blocked パターンが idle / working 画面にマッチしてはならない）。
5. `go test ./internal/agentdetect ./internal/agentfixtures` を実行する。

Claude Code の `background` パターン（`✻.+still running`）は、ターン完了後も残るバックグラウンド実行行用です。再採取するときはバックグラウンドシェルを走らせたセッションで `webtabinal state snapshot <session-id> --lines 20 --json` を取り、`still running` を含む行と、それを含まないターン完了行（`✻ … for <duration>` だけの負例）の両方を残してください。録画する場合:

```bash
./scripts/record-agent-fixture.sh \
  --agent claude \
  --version "$(claude --version | awk '{print $1}')" \
  --scenario background \
  --dest tests/fixtures/agents \
  -- claude
```

古いバージョンのディレクトリは削除せず、`verified_against` に新しいバージョンを追加します。

Cursor Agent `2026.08.11-e8db854` は identity、working（activity）、idle、unknown-to-idle について検証済みです。blocked / 承認の検出は**未検証**です。レビュー済みの承認フィクスチャなしに、推測の blocked パターンを追加しないでください。

### ローカル E2E

`make e2e-state AGENT=cursor-agent` はバイナリの存在を確認します。エージェントのダウンロード、設定の書き換え、CI での実行は行いません。
