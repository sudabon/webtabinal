## Why

WebTabinal 上で `zenbu-labs/terminal-code`（terminal-browser + code-server）を起動すると、次のメッセージだけを残して終了する。

```
This terminal cannot show images, which terminal-browser needs.
```

terminal-browser は起動時に kitty graphics protocol のケイパビリティを問い合わせる。`\x1b_Gi=4207,a=q,t=d,f=24,s=1,v=1;AAAA\x1b\` に続けて `\x1b[c` を送り、500ms 以内に `Gi=4207;OK` が返るかを見る（upstream `terminals/src/graphics.ts`）。応答が無い場合は `unknown` となり、`terminals/src/detect.ts` の `probed === "unknown" ? (terminal ? "supported" : "unsupported")` により、既知端末リスト（ghostty / kitty / wezterm / vscode / tmux / cmux / herdr / tty7 / supacode）にも載っていない WebTabinal は `unsupported` に落ちる。

WebTabinal が応答できない理由は 1 点である。`@xterm/xterm` 6.0.0（stable）には APC ハンドラを登録する API が存在しない（バンドル内に `registerApcHandler` は 1 件も無く、`xterm.d.ts` は「APC は未サポート」と明記している）。したがって `ESC _ G ... ESC \` を受け取る口自体が無い。

一方で Go 側は PTY のバイト列を一切書き換えずに転送しており（`internal/osc/parser.go` の Feed は「It does not strip sequences; callers forward original bytes unchanged.」）、画像シーケンスはすでにフロントエンドまで到達している。壁はフロントエンドだけである。

`@xterm/addon-image` の beta 系（`0.10.0-beta.299`）に Kitty graphics 実装が入っており、terminal-browser が実際に使う機能と過不足なく一致する。自前実装ではなく公式アドオンに乗る。

## What Changes

- `web/package.json` の xterm.js スタックを beta チャンネルへ揃え、`@xterm/addon-image` を追加する。`@xterm/addon-image@beta` の peer が `@xterm/xterm ^6.1.0-beta.301` 固定であるため、core と既存アドオン（fit / search / web-links / webgl）を同時に beta へ上げる必要がある。片方だけの更新は不可
- beta は rolling リリースであるため、`^` を付けずバージョンを完全固定する
- `web/src/components/TerminalView.tsx` で `ImageAddon` を読み込む。`allowProposedApi: true` は既に有効なので追加設定は不要
- 副次的に Sixel と iTerm2 inline image (IIP) にも対応する。アドオンの既定値をそのまま使うため
- 本 change のゴールは「terminal-code が起動し、画面が描画されること」までとする。実用速度への最適化は対象外とし、実測値を記録したうえで別 change に切る

## Capabilities

### New Capabilities

（なし）

### Modified Capabilities

- `terminal-ui`: xterm.js が読み込むアドオン群に image を加え、kitty graphics protocol / Sixel / iTerm2 IIP による画像描画と、CSI 14t / 16t / 18t によるピクセルサイズ報告を要求に加える

## Impact

- Frontend deps: `web/package.json` / `web/package-lock.json`
  - `@xterm/xterm` `^6.0.0` → `6.1.0-beta.302`
  - `@xterm/addon-fit` `^0.11.0` → `0.12.0-beta.299`
  - `@xterm/addon-search` `^0.16.0` → `0.17.0-beta.299`
  - `@xterm/addon-web-links` `^0.12.0` → `0.13.0-beta.299`
  - `@xterm/addon-webgl` `^0.19.0` → `0.20.0-beta.298`
  - `@xterm/addon-image` `0.10.0-beta.299`（新規）
- Frontend code: `web/src/components/TerminalView.tsx` の ImageAddon 読み込み、`web/src/ws.ts` の同一ティック input 連結
- Go: CSP に `script-src 'self' 'wasm-unsafe-eval'` を追加（ImageAddon の WASM）。WS プロトコルと PTY バイト列は変更なし
- 本番依存に beta を持ち込む。stable への追随が必要になる（`@xterm/addon-image` の stable 最新 0.9.0 には Kitty 実装が含まれない）
- ネイティブ `.app` は常に DOM レンダラ（`web/src/util.ts` が `__WEBTABINAL_DESKTOP__` で WebGL を無効化）。ImageAddon は overlay canvas のため DOM 経路でも読み込む（desktop だけ `kittySupport: false` にはしない）
- 既知の制約（本 change では解消しない）
  - `internal/session/ring.go` のリングバッファはバイト境界を無視して古い側を切るため、再接続リプレイで APC シーケンスが途中から流れ得る
  - `?1016`（ピクセル単位マウス）/ `?2048`（in-band resize）/ `>1u`（kitty keyboard protocol）/ `?2026`（同期更新）は xterm.js 未対応。terminal-browser 側は全てフォールバックするため起動はするが、マウス座標がセル単位になる
  - WebTabinal は terminal-browser の端末認識リストに無いため、ペインを開く系の機能は「認識されない端末」の扱いのままとなる
  - Retina では CSI 14t が CSS ピクセルを返す。terminal-browser は `reportsCssPixels` を立てないため画像スケールがずれ得る → follow-up で upstream 検出モジュールを提案する

## Measurement (2026-08-22, Chrome, devicePixelRatio=2, isolated daemon on :18642)

- Kitty プローブ往復（query + DA1）: **32ms**（500ms 制限に対して十分。同一ティックの OK+DA1 を 1 WS フレームに連結したあと）
- terminal-code (`tode`) は `This terminal cannot show images` を出さず起動し、code-server の Activity Bar / Explorer / Welcome が描画された
- `TERMINAL_BROWSER_SKIP_GRAPHICS_CHECK=1` でも同様に描画される。差は起動時の 500ms プローブの有無のみ
- Image layer は 936×816 CSS ピクセル（WebGL 本体は 1872×1632 デバイスピクセル）。Retina で UI が二重に見える／ずれる
- JS heap: 約 27MB used / 30MB total。`pixelLimit` 等は既定のまま
- 体感: 起動と初回描画は到達。フレーム更新は WS JSON+base64 経由のためネイティブ端末より明らかに遅い。入力は届くが Retina ずれでヒット位置が直感とずれる
- 常用可否: **「起動して画面が見える」までは可。日常の編集端末としてはまだ不足**（スケールずれ + スループット）
- DOM レンダラ（`__WEBTABINAL_DESKTOP__`、WebGL canvas なし）でも ImageAddon overlay に tode UI が描画された。ネイティブ `.app` は `make desktop` 済み。本番デーモン（:8642）には接続していない
- 別 change は `openspec/changes/support-kitty-graphics/FOLLOWUPS.md` に起票した（WS バイナリフレーム化、terminal-browser への WebTabinal 検出）
