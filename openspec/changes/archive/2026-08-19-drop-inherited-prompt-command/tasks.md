## 1. セッション環境のフィルタ

- [x] 1.1 `internal/session` に、`PROMPT_COMMAND` を含む環境から `shellEnv()` を組み立てたとき結果に含まれないこと、無関係な変数は保持されること、`WEBTABINAL_SESSION_ID` / `TERM` / テーマ / ロケールの既存挙動が変わらないことを確かめるテストを追加する
- [x] 1.2 `shellEnv()` の環境フィルタで `PROMPT_COMMAND` を除去する。既存の `mergeThemeEnv()` のキー除外と同じ仕組みに載せる

## 2. ドキュメント

- [x] 2.1 README のトラブルシューティング表に、ターミナルから daemon を起動したとき `command not found` がプロンプトごとに出る症状とその原因・対処を追加する

## 3. 検証

- [x] 3.1 `go test ./...` を実行する
- [x] 3.2 `PROMPT_COMMAND` を export したシェルから daemon を起動し、セッションのプロンプトにエラーが出ないことをライブで確認する
