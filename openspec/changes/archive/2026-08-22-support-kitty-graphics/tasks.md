## 1. 依存の更新

- [x] 1.1 `npm view @xterm/xterm dist-tags` ほか 5 パッケージで最新 beta を確認し、peer 範囲（`@xterm/xterm ^6.1.0-beta.301`）が満たされる組み合わせを確定する
- [x] 1.2 `web/package.json` の `@xterm/xterm` / `addon-fit` / `addon-search` / `addon-web-links` / `addon-webgl` を beta の完全固定バージョンへ変更する
- [x] 1.3 `@xterm/addon-image` を完全固定バージョンで追加する
- [x] 1.4 `cd web && npm install` で lockfile を更新し、peer 警告が出ないことを確認する

## 2. フロントエンドの実装

- [x] 2.1 `web/src/components/TerminalView.tsx` に `ImageAddon` を import する
- [x] 2.2 `term.open()` と `WebglAddon` の読み込みの後に `term.loadAddon(new ImageAddon({ ... }))` を追加する
- [x] 2.3 オプションは既定値（`kittySupport: true` / `enableSizeReports: true` / `sixelSupport: true` / `iipSupport: true`）で開始する
- [x] 2.4 `allowProposedApi: true` が有効なままであることを確認する
- [x] 2.5 `WebglAddon` の前後どちらで読み込むべきかを実機で確認し、確定した順序を design.md の Open Questions に反映する

## 3. プロトコル単体の検証

- [x] 3.1 WebTabinal のシェルで `printf '\e_Gi=4207,a=q,t=d,f=24,s=1,v=1;AAAA\e\\'` を実行し、`Gi=4207;OK` が返ることを確認する
- [x] 3.2 `printf '\e[14t'` と `printf '\e[16t'` でピクセルサイズ報告が返ることを確認する
- [x] 3.3 小さな PNG を `a=T,f=100,t=d` で送り、画像が描画されることを確認する
- [x] 3.4 `a=q,t=s` に対して `EINVAL` 相当が返ることを確認する（インライン転送へのフォールバック経路）
- [x] 3.5 `a=d,d=A` で画像が消えることを確認する

## 4. terminal-code での end-to-end 検証

- [x] 4.1 `make build` して `./bin/webtabinal serve` で起動する
- [x] 4.2 terminal-code を起動し、`This terminal cannot show images` が出ないことを確認する
- [x] 4.3 code-server の画面が描画されることを確認する
- [x] 4.4 クリック・スクロール・キー入力が通ることを確認する
- [x] 4.5 対照実験として `TERMINAL_BROWSER_SKIP_GRAPHICS_CHECK=1` 付きでも起動し、挙動差を記録する
- [x] 4.6 Retina 環境で画像のスケールがずれていないかを確認する。ずれる場合は upstream への検出モジュール追加を follow-up として起票する

## 5. 回帰確認

- [x] 5.1 `cd web && npx tsc -b && npx oxlint && npm run build && npm test`
- [x] 5.2 `go test ./...`
- [x] 5.3 通常のシェル操作、`vim` / `less`、日本語 IME、Cmd+C コピー、検索、タブ切替を確認する
- [x] 5.4 リロードによる再接続とリプレイが従来どおり動くことを確認する
- [x] 5.5 ターミナルのリサイズ（`fit` → WS `resize`）が従来どおり動くことを確認する
- [x] 5.6 `make desktop` でネイティブ `.app` をビルドし、DOM レンダラ経路で 4.2〜4.4 と 5.3 を確認する
- [x] 5.7 DOM レンダラで実用にならない場合の扱い（desktop のみ `kittySupport: false` / WebGL 許可 / 現状維持）を決め、design.md に記録する

## 6. 実測と記録

- [x] 6.1 terminal-code 操作中の WS スループットを測定する（DevTools Network もしくはデーモン側の計測）
- [x] 6.2 体感 FPS と入力レイテンシを記録する
- [x] 6.3 ブラウザのメモリ使用量を確認し、必要なら `pixelLimit` / `storageLimit` / `kittySizeLimit` を調整する
- [x] 6.4 測定結果を proposal.md に追記し、常用可否を明記する
- [x] 6.5 実用に耐えない場合、最適化（WS バイナリフレーム化・フロー制御）を別 change として起票する

## 7. ドキュメント

- [x] 7.1 README に画像プロトコル対応（kitty graphics / Sixel / iTerm2 IIP）と既知の制約を追記する
- [x] 7.2 beta 依存を採用している理由と stable へ戻す条件を README もしくは CONTRIBUTING に記録する
