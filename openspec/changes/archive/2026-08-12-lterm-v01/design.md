## Context

グリーンフィールド。`terminal-app-spec-v0.1.md` を正とする。対象は macOS 個人利用のみ。ブラウザ（PWA）が描画、Go デーモンが PTY・セッション・スクロールバックの真実を持つ。既存コードベースはなく、単一リポジトリでデーモンとフロントを新規構築する。製品名は **WebTabinal**。

## Goals / Non-Goals

**Goals:**

- v0.1 スコープ（サイドバータブ、シェル統合、再接続 replay、通知、PWA、localhost セキュリティ）を実装可能にする
- 「真実はデーモン側」でブラウザ誤クローズを無害化する
- マイルストーン M1→M5 で段階的に検証できる設計にする

**Non-Goals:**

- ペイン分割、デーモン再起動跨ぎ復元、リモート接続、マルチユーザー
- bash/fish 統合、Claude Code hooks、テーマ設定 UI、SQLite、WS バイナリフレーム

## Decisions

### D1. 単一 Go バイナリ + embed.FS

- **選択**: Vite ビルド成果物を `embed.FS` でデーモンに同梱し、HTTP で配信
- **代替**: フロント別配信 / Electron
- **理由**: インストール単位を 1 バイナリに揃え、PWA はブラウザに任せる

### D2. セッション状態はメモリのみ、設定は JSON

- **選択**: `~/Library/Application Support/WebTabinal/config.json` のみ永続化。セッション・リングバッファはデーモンメモリ
- **代替**: SQLite でセッション復元
- **理由**: v0.1 はデーモン生存中の復元で十分。DB なしで単純化

### D3. WebSocket は単一接続・JSON + base64 多重化

- **選択**: `/api/ws` 1 本で全セッション。`attach` / `input` / `resize` / `replay` / `output` / `state` / `sessions`
- **代替**: セッションごと WS / バイナリフレーム
- **理由**: ローカル帯域は十分。実装・デバッグが容易。バイナリは v0.2

### D4. シェル統合は OSC 横取り（イベント駆動）

- **選択**: デーモンが PTY 出力から OSC 7 / 133 / 9973 をパースし、xterm.js にも素通し
- **代替**: ポーリングのみ / Claude hooks 依存
- **理由**: 正確・低負荷。未統合は `TIOCGPGRP` フォールバックで best effort

### D5. セキュリティは bind + Host/Origin + Cookie トークンの 3 点

- **選択**: `127.0.0.1` のみ、Host/Origin 検証、初回生成トークンを SameSite=Strict Cookie
- **代替**: 認証なし / mTLS
- **理由**: シェルリモコン相当のため localhost でも必須。将来は認証ミドルウェア差し込み口を残す

### D6. UI は左サイドバー専用（上部タブバーなし）

- **選択**: React + @dnd-kit/sortable。タブ 3 段（CWD basename / cmd / state）
- **代替**: 上部タブバー / ツリー
- **理由**: 仕様の核心 UX。幅は config に永続化

### D7. standalone 時は最後のタブで `window.close()`

- **選択**: sessions 1→0 かつ `display-mode: standalone` ならウィンドウ終了。失敗時は空状態 UI。デーモンは launchd 常駐のまま
- **代替**: 常に空状態 / デーモンも止める
- **理由**: デスクトップアプリ感。次回は Dock から即再開。起動時 0 件ならタブ 1 つ自動作成

### D8. 製品名・ポート・キーバインド・フォント（確定）

- **製品名**: WebTabinal（CLI / バイナリ: `webtabinal`、Application Support / Logs / LaunchAgent も同名体系）
- **既定ポート**: `8642`
- **新規タブ**: `Cmd+N`
- **既定フォント**: VS Code macOS 既定と同じ `Menlo, Monaco, 'Courier New', monospace`（`font_size` は 14）
- **私的 OSC**: `9973`（実装固定。変更時は統合スクリプトのバージョン上書きで追随）
- **セッション env**: `WEBTABINAL_SESSION_ID=<id>`

## Risks / Trade-offs

- [ブラウザ予約キーを奪えない] → セッションはデーモン生存で無害化。running 時は `beforeunload` 確認。`Cmd+N` もブラウザ／PWA によっては新規ウィンドウに取られる可能性があるため、サイドバーの［＋］を常に提供する
- [デーモン再起動で全セッション消滅] → v0.1 の意図した制約。ドキュメント化
- [`window.close()` がブロックされる環境] → 空状態画面フォールバック
- [シェル統合未導入ユーザー] → フォールバック状態表示 + 「統合なし」アイコン。導入手順を CLI/README に明記
- [私的 OSC 番号の衝突] → 番号を固定し、変更時は統合スクリプトのバージョン上書きで追随
- [Menlo の日本語カバレッジ] → システムフォールバックに依存（VS Code と同じ方針）

## Migration Plan

1. リポジトリ初期化（Go module + Vite/React）
2. M1 疎通 → M2 シェル統合 → M3 タブ操作 → M4 通知/PWA → M5 再接続・仕上げ
3. `webtabinal install` で LaunchAgent 投入、`.zshrc` 1 行追加、ブラウザで PWA インストール
4. ロールバック: `webtabinal uninstall` + 統合 1 行削除。設定・ログは手動削除可

## Open Questions

（なし — 2026-08-13 に確定済み）
