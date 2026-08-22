# Follow-ups from support-kitty-graphics

本 change では「kitty プローブに応答し、terminal-code が描画される」までをゴールとした。実装と実測で分かった残りは次の 2 件。いずれも別 change で扱う。

## 1. terminal-browser に WebTabinal 検出を追加（Retina スケール）

- **現象**: `devicePixelRatio=2` で CSI 14t は CSS ピクセル（例: `4;816;936t`）、image layer も CSS ピクセル。WebGL canvas はデバイスピクセル。terminal-browser は WebTabinal を既知端末と見なさないため `reportsCssPixels` が立たず、Activity Bar / Explorer が二重・ずれる。
- **方針**: upstream（`zenbu-labs/terminal-browser` の端末検出モジュール）に WebTabinal を追加し `reportsCssPixels: true` を付ける。WebTabinal 側の CSI 14t をデバイスピクセルに変える案は、他のクライアントとの整合を崩すので第一候補にしない。
- **OpenSpec**: `/opsx:new detect-webtabinal-in-terminal-browser`（upstream 連携が主。本リポジトリのコード変更は検出用の識別子を出す必要がある場合のみ）

## 2. WebSocket のバイナリフレーム化とフロー制御

- **現象**: PTY → JSON + base64 のため、terminal-code のフレーム更新はネイティブ端末より明らかに遅い。プローブ往復は 32ms で足りるが、常用の編集端末としては不足。
- **方針**: WS をバイナリフレームにし、バックプレッシャ / フロー制御を入れる。ImageAddon の `pixelLimit` / `storageLimit` は今回のヒープ（約 27MB）では触らなくてよい。
- **OpenSpec**: `/opsx:new ws-binary-frames`
