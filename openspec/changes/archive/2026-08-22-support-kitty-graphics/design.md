## Context

WebTabinal のターミナル描画は「Go デーモン（PTY 所有）→ gorilla/websocket → React + xterm.js」の 1 ホップ構成である。

- PTY 読み取りは `internal/session/session.go` の 32KB ループ。読んだチャンクは Ring / OSC parser / ヘッドレス VT / `onOutput` に配られる
- `internal/server/ws.go` はチャンクを base64 化し、JSON テキストフレーム `{"t":"output","sid":...,"data":"<base64>"}` として送る
- フロントは `web/src/components/TerminalView.tsx` の `term.write(bytes)` が唯一の描画入口。`term.parser.*` によるハンドラ登録は現状ゼロ
- レンダラは Chromium 系なら WebGL、Safari とネイティブ `.app` では DOM（`web/src/util.ts`）

画像プロトコルに関する実装・設定・仕様はプロジェクト内に一切無い。`internal/osc/parser.go` がヒットする「kitty」は OSC 99（デスクトップ通知）であり graphics protocol ではない。

terminal-browser が要求する端末機能は upstream のソースから確定している。

- ケイパティビリティ問い合わせ: `\x1b_Gi=<id>,a=q,t=d,f=24,s=1,v=1;AAAA`（`terminals/src/graphics.ts`）
- 転送媒体の事前問い合わせ: `a=q,t=s`（共有メモリ）/ `a=q,t=f`（ファイル）（`engine/crates/pixel-core/src/kitty.rs` の `kitty_query_medium`）
- フレーム転送: `a=T,f=32,o=z,s=<w>,v=<h>,t=d,i=<id>,p=1,C=1,q=2,m=<0|1>` を 4096 バイトごとにチャンク分割（同 `kitty_transmit_placed`）
- 削除: `a=d,d=A`（非中継時）/ `a=d,d=I,i=<id>`（tmux 中継時）
- ピクセルサイズ問い合わせ: `\x1b[14t` / `\x1b[16t`
- 起動時に有効化するモード: `?1049h ?25l ?1003h ?1006h ?1016h ?1004h ?2004h ?2048h >1u`、加えて `>4;2m` と `?2031h`、フレームごとに `?2026h` / `?2026l`

## Goals / Non-Goals

**Goals:**

- terminal-code / terminal-browser が WebTabinal 上で起動し、画面が描画される
- 実装は公式アドオンに乗せ、プロトコルの自前実装を持たない
- Go 側とプロトコルを変更しない
- 性能と入力精度の実測値を取り、常用可否を判断できる材料を残す

**Non-Goals:**

- 実用速度への最適化（WS のバイナリフレーム化、フロー制御、差分転送）
- `internal/session/ring.go` の画像シーケンス対応
- `?1016` / `?2048` / kitty keyboard protocol / `?2026` の実装
- 共有メモリ・ファイル転送（`t=s` / `t=f`）への対応
- terminal-browser upstream への WebTabinal 検出モジュールの追加

## Decisions

### 公式 beta アドオンを採用し、kitty graphics を自前実装しない

`@xterm/addon-image` beta（`addons/addon-image/src/kitty/KittyGraphicsHandler.ts`）が terminal-browser の要求と過不足なく一致する。

| terminal-browser が出すもの | アドオンの挙動 |
|---|---|
| `a=q,t=d,f=24,s=1,v=1;AAAA` | ペイロード長を検証して `OK` を返す |
| `a=q,t=s` / `t=f` | `EINVAL:unsupported transmission medium` を返す。送信側はインライン転送へフォールバックする |
| `a=T,f=32,o=z,t=d,m=1/0` | `DecompressionStream('deflate')` で展開して描画する |
| `p=1,C=1` | 画像配置前のカーソル位置を復元する |
| `a=d,d=A` / `d=I` | 対応済み |
| `\x1b[14t` / `16t` / `18t` | `enableSizeReports`（既定 true）が windowOptions を有効化する |

自前実装の代替案は、`term.write` の手前で `\x1b_G...\x1b\` を抜き取り、オーバーレイ canvas に描画するというもの。terminal-browser が使う subset は「単一画像・全画面・カーソル固定・毎フレーム置換」と狭いため実装自体は可能だが、チャンク再結合・zlib 展開・クエリ応答の注入・カーソル意味論を自前で保守することになる。upstream が既に実装している以上、割に合わない。

### core を含めた beta 一括更新を受け入れる

`@xterm/addon-image@beta` の peer は `@xterm/xterm ^6.1.0-beta.301` である。`@xterm/xterm` 6.0.0 には APC ハンドラ API が無いため、そもそも stable のままでは動かない。fit / search / web-links / webgl の各 beta も同じ peer 範囲を要求するため、5 パッケージを同時に上げる。

beta は rolling であり、`^` を付けると意図しない差分を拾う。全て完全固定し、更新は明示的な操作に限る。

`@xterm/addon-image` の README は Kitty サポートを "alpha stage" と表記している。`a=p`（既存画像の再配置）、Unicode placeholder（tmux 経由で必要）、アニメーション（`a=f` / `a=a` / `a=c`）は未実装だが、いずれも terminal-browser の非中継パスでは使われない。

### Sixel と IIP も既定のまま有効にする

`sixelSupport` / `iipSupport` は既定 true である。無効化する理由が無く、他の画像出力ツールにも利いてくる。ただし Sixel を能力として広告するわけではない点に注意する。DA1 応答は xterm.js core が返す `\x1b[?1;2c` のままで、Sixel を示す `4` は含まれない。terminal-browser は DA1 をプローブの終端マーカーとしてしか使わないため、本件では問題にならない。

### スコープを「起動して描画される」までに切る

terminal-browser は毎フレーム、ウィンドウ全体の RGBA を zlib(level 1) + base64 で送る。共有メモリ転送が使えないため、WebTabinal では常にインライン転送になり、`internal/server/ws.go` の base64 化でさらに約 1.78 倍になる。`@xterm/addon-image` の README 自身が「PTY → server → websocket → xterm.js の経路は高レイテンシであり、リアルタイム描画アプリには不向き」と明記している。

したがって本 change では動作到達を確認し、スループットと体感を実測して記録するところまでを引き受ける。最適化は測定結果を見てから別 change に切る。

## Risks / Trade-offs

- **本番依存に beta を持ち込む** → 全バージョンを完全固定する。stable の `@xterm/addon-image` に Kitty 実装が入った時点で stable へ戻す
- **beta core による既存機能の回帰**（IME・クリップボード・検索・リサイズ・リプレイ） → 既存の web テストと `make desktop` を含む手動確認で洗う。回帰が出た場合は beta のバージョンを 1 つ戻して切り分ける
- **ネイティブ `.app` は DOM レンダラ固定** → 実機で描画可否と速度を確認する。動かない、または極端に遅い場合は desktop に限り `kittySupport: false` にするか、WebGL を許可するかを別途判断する
- **メモリ使用量** → アドオンは復号中に RGBA バッファを 2 面持つ。既定の `pixelLimit` は 16M ピクセル（約 128MB）である。実測して必要なら `pixelLimit` / `storageLimit` / `kittySizeLimit` を下げる
- **フロー制御が無い** → `term.write` にバックプレッシャをかけていない。アドオンの README が明示的に警告している項目である。実測で問題が出た場合は別 change でフロー制御を入れる
- **再接続リプレイでの破損** → リングバッファがバイト境界を無視するため、リプレイ時に APC が途中から流れ得る。xterm.js は ST が来るまで読み捨てるため画面が壊れる程度で済むが、既知の制約として記録する

## Open Questions

（実装中に解決。記録は Resolved during implementation を参照）

## Resolved during implementation

### ImageAddon は `term.open()` と WebglAddon の後に読む

Chrome（WebGL 経路）で確認した。`ImageRenderer` は activate 時に `_core.open` をラップし、すでに `screenElement` があればすぐ `_open()` して現行の `renderService` を掴む。WebGL 後に読むと renderer swap を挟まず overlay canvas を載せられる。逆順でも `setRenderer` をフックしてレイヤを張り直すため描画自体は回復するが、初期案どおり **open → WebglAddon → ImageAddon** で固定する。

### `@xterm/addon-image` は WASM を instantiate するため CSP に `'wasm-unsafe-eval'` が必要

`KittyGraphicsHandler` が `xterm-wasm-parts` の Base64Decoder.wasm を使う。`default-src 'self'` だけでは `WebAssembly.instantiate` が拒否され、アドオンが activate に失敗する。`script-src 'self' 'wasm-unsafe-eval'` を追加した。フル `unsafe-eval` は付けない。

### 同一ティックの xterm `onData` は 1 つの PTY 書き込みにまとめる

terminal-browser のプローブは kitty クエリの直後に `CSI c`（DA1）を同じチャンクで送る。ImageAddon は `Gi=…;OK` と DA1 応答を別々の `triggerDataEvent` で出す。別 WS フレームになると、プロセス側の 500ms タイムアウト内に `Gi=4207;OK` が見えず `unknown` → `unsupported` になる。`TerminalSocket.input` は microtask で同一 sid の入力を連結する。

### DOM レンダラでも ImageAddon は読む（desktop で `kittySupport` を切らない）

ネイティブ `.app` は `__WEBTABINAL_DESKTOP__` で WebGL を無効化するが、ImageAddon は overlay canvas のため DOM レンダラでも載る。desktop だけ無効化すると kitty プローブが失敗し terminal-code が起動しない。遅ければ follow-up で描画品質を見直す。

### Retina のスケールずれは端末検出の follow-up

`devicePixelRatio=2` で CSI 14t は CSS ピクセル（例: `4;816;936t`）、CSI 16t はセルサイズ（`6;16;8t`）。WebGL canvas はデバイスピクセル、image layer は CSS ピクセル。WebTabinal は terminal-browser の既知端末ではないため `reportsCssPixels` が立たず、UI が二重／ずれる。本 change では修正せず、upstream 検出モジュール追加を follow-up とする。

### スループット

Kitty プローブ往復は 32ms。terminal-code は描画まで到達するが、PTY → WS JSON+base64 のためフレーム更新はネイティブ端末より遅い。常用可否の判断は proposal の Measurement 節。
