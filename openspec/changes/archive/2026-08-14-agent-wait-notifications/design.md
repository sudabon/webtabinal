## Context

現行のデスクトップ通知は WebSocket `state` が idle になったとき（`OSC 133;D` またはフォールバック）だけ発火する。Claude Code / Codex / cursor-agent は承認・質問・sudo で **プロセスが running のまま** 止まるため、完了通知では拾えない。3ツールとも iTerm2 OSC 9 または Kitty OSC 99 で待ちを出せる。パーサは OSC 7 / 133 / 9973 のみ。

## Goals / Non-Goals

**Goals:**

- PTY の OSC 9 / OSC 99 を検出して macOS 通知にする
- セッション state は `running` のまま、エフェメラルな WS `notify` で UI に届ける
- 完了通知と同じフォーカス抑制とクリックでタブ切替。待ち通知には `min_duration_ms` を適用しない
- 非アクティブタブは未読ドットと Dock badge を付ける
- README に 3 ツールの OSC 有効化を書く

**Non-Goals:**

- TUI テキストのヒューリスティック検出
- `~/.claude` / `~/.codex` / `~/.cursor` へのフック書き込み
- 通知からの Accept/Reject
- `TERM_PROGRAM` 偽装
- サウンド（`sound` は予約のまま）
- 新しい設定キー

## Decisions

### 1. 検出は OSC 9 と OSC 99 のみ

- **選択**: `internal/osc.Parser` に `EventNotify` を追加。OSC 9 は `;` 以降をメッセージ全体、OSC 99 は Kitty の `p=title` / `p=body`（無ければ payload）を使う
- **理由**: 3ツールが既に出す共通プロトコル。スクレイピングより誤検知が少ない
- **代替案**: BEL 全捕捉 → ノイズが多い。プロセス名ヒューリスティック → 壊れやすい

### 2. セッション state は変えない

- **選択**: `applyEvent` は `EventNotify` を無視する（CWD / command / idle-running を更新しない）
- **理由**: 待ち中もエージェントは foreground のまま。idle にすると完了通知と entangle する
- **代替案**: `waiting` 状態を追加 → サイドバー契約とフォールバック検出まで広がりすぎる

### 3. WS は専用 `notify` フレーム

- **選択**: `{"t":"notify","sid":"...","title":"...","body":"..."}` を全クライアントへ broadcast。attach 不要
- **理由**: バックグラウンドタブでも届ける。`state` に載せると「変化なし」で落ちる
- **代替案**: `state` に `notify_title` を載せる → 永続フィールドになり、再接続で再通知しうる

### 4. 抑制と badge は完了通知を再利用

- **選択**: `notification.enabled` / `always` / アクティブ+フォーカス抑制は完了通知と同じ。`min_duration_ms` は待ちには使わない。非アクティブなら既存の unread Set と `setAppBadge`
- **理由**: 待ちは短いコマンド完了より見逃したくない。設定キーを増やさない
- **代替案**: `notification.agent_wait` トグル → v0 では過剰

### 5. 空メッセージは捨てる

- **選択**: title も body も空ならイベントも WS も出さない
- **理由**: 空 OSC でバナーが点灯するのを防ぐ

## Risks / Trade-offs

- [WebTabinal が未知ターミナル扱いで OSC が出ない] → README に Codex `osc9` / Claude フック / cursor-agent `notifications: true` を書く。`TERM_PROGRAM` 偽装は別 change
- [OSC 99 のパラメータ方言] → Kitty の `i=` / `p=title|body` を最低限パースし、未知キーは無視
- [同一待ちで OSC が複数回来る] → 来た分だけ通知する。デバウンスは入れない
- [xterm が OSC 9/99 を解釈して二重通知] → シーケンスは素通しする。xterm.js は通常デスクトップ通知を出さない。出る場合は別途抑える

## Migration Plan

1. パーサ → WS `notify` → フロント通知の順で入れる。設定スキーマ変更なし
2. ロールバック: `EventNotify` と `notify` フレームを外せば旧完了通知のみに戻る

## Open Questions

- なし（cursor-agent が WebTabinal で OSC を出すかは手動確認。出なければ README のフック例で足りる）
