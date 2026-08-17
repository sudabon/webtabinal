## Context

WebTabinal のデスクトップ版は Electron ではなく、Swift/AppKit のウィンドウ内に daemon の Web UI を `WKWebView` で表示する構成である。daemon は OSC 9 / OSC 99 を `notify` WebSocket フレームへ変換し、React はコマンド完了とエージェント待ちの両方で Web Notification API を呼ぶところまで実装済みである。

現在は初期ロード後に `Notification.requestPermission()` を自動実行している。WKWebView ではユーザー操作のない権限要求が拒否され、permission は `default` のまま残るため、`Notification.permission === "granted"` のガードから先へ進まない。さらにエージェント側には、Codex の明示的な OSC 9 設定と Claude Code の完了 hook が入っておらず、通知イベント自体が届かないケースがある。

既存の通知可否判定、OSC パーサ、WebSocket `notify` 契約、未読状態は正しく動作しているため、この change ではその上流・下流契約を保ったまま、表示プロバイダーと権限取得を修正する。

## Goals / Non-Goals

**Goals:**

- macOS ネイティブ版で、コマンド完了およびエージェントのタスク完了・入力待ちを `UNUserNotificationCenter` から確実に通知する
- ブラウザ / PWA とネイティブ版で同じ抑制判定と通知内容を使い、表示部分だけを実行環境に応じて切り替える
- 通知権限の状態をユーザーに見せ、必ず明示的なユーザー操作から権限を要求する
- 通知クリックでアプリを前面化し、通知元セッションへ切り替える
- Codex・Claude Code・cursor-agent が OSC 通知を出すための正確な設定と診断手順を提供する
- 実 OS の許可ダイアログ以外は、自動テスト可能な境界へ分離する

**Non-Goals:**

- ユーザーの `~/.codex`、`~/.claude`、`~/.cursor` をアプリから自動変更すること
- TUI 文字列のスクレイピング、任意の BEL、プロセス名ヒューリスティックによる待ち判定
- 通知から承認・拒否・プロンプト回答を行うアクション通知
- 通知サウンド、通知履歴、通知のデバウンス
- daemon の OSC / WebSocket プロトコルや設定ファイルスキーマの変更

## Decisions

### 1. 通知ポリシーと表示プロバイダーを分離する

React は現在と同様に `notification.enabled`、`notification.always`、アクティブタブ、ウィンドウフォーカス、完了時間から通知可否を一度だけ決定する。通知対象になった場合、共通の通知ディスパッチャーが次のプロバイダーへ振り分ける。

- ネイティブ版: Swift ブリッジへ `{ sid, title, body }` を送る
- ブラウザ / PWA: permission が `granted` の場合のみ Web Notification API を使う
- 未対応環境または権限なし: OS バナーは出さないが、既存の未読ドットと badge の処理は維持する

これにより完了通知と OSC 待ち通知の重複コードを減らし、WKWebView 内で Web Notification とネイティブ通知が二重に出ることを防ぐ。Swift 側で抑制判定を再実装する案は、セッション状態と設定値の二重管理になるため採用しない。

### 2. 通知専用の reply-capable WKScriptMessage bridge を追加する

既存の close / clipboard handler を変更せず、通知専用 handler を追加する。Web 側は Promise ベースの薄い API として扱い、次の操作を送る。

- `getPermission`: 現在の native authorization status を取得する
- `requestPermission`: `UNUserNotificationCenter` に alert 権限を要求し、更新後の状態を返す
- `show`: `sid`、`title`、`body` を持つ通知を登録する

Swift 側は `WKScriptMessageHandlerWithReply` を使い、`UNUserNotificationCenter` を包むサービスへ委譲する。メッセージは main frame かつ設定済み loopback origin からのものだけを受け入れ、型と必須フィールドを検証する。既存 handler を通知にも流用する案は、非同期の権限照会結果を JavaScript へ返すために独自 callback ID が必要になるため採用しない。

WebKit の Notification API をユーザークリックから再度使うだけの最小修正はブラウザ版には適用するが、ネイティブ版には採用しない。macOS 標準 API のほうが permission、foreground presentation、クリック処理を一つの bundle identity で扱えるためである。

### 3. 権限取得は設定画面の明示操作に限定する

設定画面に「通知」カテゴリを追加し、アプリ内設定と OS / browser permission を別々に表示する。

- `notification.enabled` と `notification.always` は既存 config API へ即時保存する
- permission は `default`、`granted`、`denied`、`unsupported` の共通状態へ正規化する
- `default` のときだけ「通知を許可」操作から permission を要求する
- `denied` のときは再度ダイアログが出ると誤認させず、macOS / browser 側の設定変更が必要であることを示す
- 設定カテゴリを開いた時と window focus 復帰時に permission を再照会する

初期ロード時の `Notification.requestPermission()` は削除する。config の enabled と OS permission は意味が異なるため、新しい永続設定キーは追加しない。

### 4. native notification の activation は session ID で往復する

Swift は通知ごとに一意な request identifier を使い、`userInfo` に `sid` を保存する。`UNUserNotificationCenterDelegate` は foreground 中にも banner/list を提示するが、sound は指定しない。React が事前に抑制済みなので、`notification.always=true` の通知もここで失われない。

通知クリック時は NSApplication と window を前面化し、JavaScript の固定イベントへ JSON エンコードした `sid` を渡す。React は通常のタブ選択処理を再利用し、terminal focus と未読解除も行う。WebView の初期ロード前にクリック callback が来た場合は Swift が `sid` を一件保持し、navigation 完了後に配送する。

任意の JavaScript 文字列を通知 payload から組み立てず、session ID を JSON エンコードして固定イベントへ渡すことで script injection を避ける。

### 5. エージェント連携の境界は OSC 9 / OSC 99 のまま維持する

daemon の検出方式は変更しない。README では通知の2段階、すなわち「エージェントが OSC を出すこと」と「WebTabinal / macOS の通知が許可されていること」を分けて診断できるようにする。

- Codex: turn completion / approval eventを有効にし、`notification_method = "osc9"` を明示する。必要な場合だけ tool 側と WebTabinal 側の両方を always にする
- Claude Code: `Stop` hook で turn completion、`PermissionRequest` と `Notification` hook で承認・idle prompt を OSC 9 として `/dev/tty` へ出す
- cursor-agent: 現行バージョンで `notifications: true` が実際に OSC 9 / 99 を出すかを確認し、未確認の挙動を保証として記載しない。共通の OSC probe で WebTabinal 側と tool 側を切り分ける

外部設定の自動書き換えや BEL の捕捉は誤通知とアップデート追従のリスクが高いため行わない。

### 6. OS API は注入可能なサービス境界でテストする

UserNotifications の status mapping、request content、session metadata を pure data / protocol 境界へ分離し、fake notification center で Swift テストする。Web 側は provider 選択、permission request がクリックからだけ呼ばれること、WS notify から native `show` message が一回だけ送られること、activation event が既存の select 処理へ届くことをテストする。

実 permission prompt と Notification Center banner は自動化が不安定なため、ビルドした `.app` を `/Applications` から起動する手動 smoke test をリリース確認に残す。

## Risks / Trade-offs

- [macOS permission が過去に denied] → 設定画面で現在状態と System Settings での変更が必要なことを表示し、focus 復帰時に再取得する
- [ad-hoc build とインストール先で通知 identity が変わる] → 安定した `CFBundleIdentifier` を維持し、実際の配布先 `/Applications/WebTabinal.app` で smoke test する
- [通知クリック時に WebView が未ロード] → pending session ID を保持し、最初の navigation 完了後に一度だけ配送する
- [native と Web Notification の二重表示] → native desktop 判定時は Web Notification API を一切呼ばない provider selection test を置く
- [エージェントの将来バージョンで設定仕様が変わる] → OSC 9 / 99 を安定契約とし、README に独立した probe と確認済みバージョンを記載する
- [複数の通知クリックが初期化前に届く] → 現在は単一 window / active session のため最後の session ID を採用する。通知履歴キューは対象外とする

## Migration Plan

1. 通知 provider と permission 状態モデルを追加し、既存 Web Notification 経路を provider 経由へ移す
2. Swift の notification service、bridge、delegate、activation callback を追加する
3. 設定画面の通知カテゴリを追加し、ロード時の自動 permission request を削除する
4. provider / bridge / Swift service のテストと `.app` smoke test を実行する
5. 3エージェントの設定例と OSC probe を更新し、確認結果をREADMEへ反映する

ロールバック時は native provider と設定カテゴリを外し、Web provider のみへ戻せる。daemon と config schema は変わらないためデータ移行は不要である。

## Open Questions

- cursor-agent `2026.08` の `notifications: true` が未知 terminal 上で使う通知方式は実装時に end-to-end 確認する。OSC 9 / 99 を出さない場合、この change では保証対象外として明記し、ヒューリスティック fallback は追加しない。
