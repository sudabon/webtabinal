## Context

動機と各エージェントの実情は proposal.md を参照。実装を縛る事実は次の 3 点。

- **stop hook は端末に書けない。** Claude Code は「hook は制御端末を持たない」と明記しており、cursor-agent も実機で `/dev/tty` を開けず `TERM=dumb` だった。OSC を PTY に直接流す経路は使えない
- **hook はセッション環境を継承する。** cursor-agent の `stop` hook が `WEBTABINAL_SESSION_ID=probe-1234` を受け取ることを実機で確認した。`shellEnv()` が全セッションに設定しているので、hook がどれだけ深い子プロセスでも届く
- **Claude Code だけは端末出力の逃げ道がある。** hook が stdout に `{"hookSpecificOutput":{"hookEventName":"Stop","terminalSequence":"…"}}` を返すと Claude Code 自身が端末へ書く（1000 文字上限、`Stop` は対応イベント）

この change は `scope-agent-notifications` に依存する。`notification.commands` と `kind=agent_idle` を前提にしており、`notifications` capability の「Notify on agent prompt return」を MODIFIED している。先に `scope-agent-notifications` を archive する必要がある。

## Goals / Non-Goals

**Goals:**

- 3 エージェントすべてで、ターン終了の通知を推測ではなくエージェントの申告で出す
- hook 側の設定を 1 行で書けるようにし、失敗してもエージェントの動作を壊さない
- 画面検知のプロンプト復帰通知を、hook を入れないユーザー向けの選択肢として残す

**Non-Goals:**

- hook 設定ファイルの自動書き換え
- `blocked` 通知や承認待ちの hook 化。画面検知と OSC で足りている
- Codex の `notify` 外部プログラムスロットの利用

## Decisions

### 配送は loopback API にする。OSC は使わない

`POST /api/sessions/{id}/notify` を追加し、`webtabinal notify` CLI が叩く。

hook が端末に書けない以上、OSC 経路は cursor-agent で成立しない。Claude Code だけ `terminalSequence`、cursor-agent だけ API という二本立てにすると、README の手順もテストも二重になる。`WEBTABINAL_SESSION_ID` は 3 エージェントすべての hook に届くので、API に寄せれば 1 本で済む。

**代替案（不採用）**: Claude Code は `terminalSequence` で OSC 9 を出す。daemon 側の変更が不要という利点はあるが、cursor-agent を救えないうえ、通知の種別（ターン終了か承認待ちか）を OSC のテキストに埋め込むしかない。README には代替手段として併記する。

### CLI は失敗しても必ず終了コード 0 にする

daemon 未起動、セッション ID 不明、接続失敗のいずれでも無言で成功終了する。

cursor-agent の `stop` hook は終了コード 2 で**エージェントの停止をブロックする**。Claude Code の `Stop` hook も同じく 2 でブロックする。通知が届かなかったことでエージェントのターンが止まるのは、通知機能として明らかに割に合わない。

同じ理由で、エンドポイントは存在しないセッション ID を成功として受け流す。hook がセッション終了と競合したときにエージェント側を巻き込まないため。

### `state.notify_on_idle` を追加し既定 false にする

画面検知のプロンプト復帰通知は消さずに残す。hook を設定していないユーザーや、hook が使えないエージェントのための唯一の手段だからである。既定を false にするのは、hook を入れた環境では二重通知になり、入れていない環境では今回の発端どおり誤検知が多いため。

4 秒の dedupe 窓があるので、hook と画面検知の両方が有効でも通知は 1 回に収束する。ただし窓を外れたタイミングでは二重になりうるので、既定オフで正しい。

### hook 設定は印字するだけで書き換えない

`webtabinal hooks print <agent>` は断片と貼り付け先のパスを出すだけにする。

`~/.claude/settings.json` と `~/.cursor/hooks.json` は他のツールと共有される設定ファイルで、実機の Codex では `notify` スロットが既に Computer Use に占有されていた。自動書き換えは他ツールの設定を壊しうるし、マージ規則を正しく実装する労力に見合わない。

## Risks / Trade-offs

- **既定オフによる無通知** → hook を設定していない既存ユーザーは、この change のあとターン完了通知を受け取れなくなる。README の移行手順に、hook を入れるか `state.notify_on_idle` を true にするかの二択を明記する。設定 UI にもトグルを出す
- **Claude Code hook の env 継承が未実測** → cursor-agent では実測したが、Claude Code の `Stop` hook が `WEBTABINAL_SESSION_ID` を継承するかは未確認。実装時に実機で確かめる。継承しない場合の代替は `terminalSequence` 経由の OSC 9 で、これは README に併記する
- **hook 設定は WebTabinal の外にある** → ユーザーがエージェントを再インストールしたり設定を書き換えると通知が黙って止まる。`webtabinal hooks print` に貼り付け先のパスを出し、トラブルシューティング表に「通知が来なくなったら hook 設定を確認する」行を足す
- **cursor-agent の hook は headless (`-p`) では発火しない** → 実測で確認済み。WebTabinal 内は対話モードなので影響しないが、README には対話モード限定であることを書く

## Migration Plan

1. `scope-agent-notifications` を先に archive する。この change はその spec に依存する
2. 既存 config は `applyDefaults()` で `state.notify_on_idle=false` が入る。画面検知のプロンプト復帰通知はここで止まる
3. ユーザーは `webtabinal hooks print <agent>` の出力を各エージェントの設定に貼る。Codex は貼るものがなく、既存の `[tui]` 設定のままでよい
4. ロールバック: `state.notify_on_idle` を true にすれば画面検知の挙動に戻る。hook 側は設定を消せばよい
