# コントリビューション

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

Cursor Agent `2026.08.11-e8db854` は identity、working（activity）、idle、unknown-to-idle について検証済みです。blocked / 承認の検出は**未検証**です。レビュー済みの承認フィクスチャなしに、推測の blocked パターンを追加しないでください。

### ローカル E2E

`make e2e-state AGENT=cursor-agent` はバイナリの存在を確認します。エージェントのダウンロード、設定の書き換え、CI での実行は行いません。
