## 1. OSC 9 サブコマンドの除外

- [x] 1.1 `internal/osc/parser_test.go` に `OSC 9;4;1;40` と `OSC 9;9;/path` が notify event を生成せず、`OSC 9;build finished` は従来どおり生成することを確かめるテストを追加する
- [x] 1.2 `internal/osc/parser.go` の `parseOSC()` で `9;` 払い出しのうち `4;` と `9;` で始まるものを notify event 化しないようにする

## 2. `state.notify_agents` 設定

- [x] 2.1 `internal/config/config_test.go` に既定値 `["claude","codex","cursor-agent"]`、`state` はあるが `notify_agents` を持たない旧 config への既定値補完、明示的な空リストの保持、空白のみの要素を含む patch の拒否とロールバックのテストを追加する
- [x] 2.2 `internal/config/config.go` の `StateConfig` に `NotifyAgents []string \`json:"notify_agents"\`` を追加し、`Defaults()` に既定リストを入れる
- [x] 2.3 `applyDefaults()` で `NotifyAgents == nil` のときだけ既定リストを補い、明示的な空リストは保持する
- [x] 2.4 `validateState()` で各要素を trim し、空文字・空白のみの要素を持つ patch を拒否する

## 3. 通知許可判定の集約

- [x] 3.1 `internal/server` に、未識別セッション・`generic`・許可リスト内 agent・許可リスト外 agent・空リスト・`state.enabled=false` の各ケースを網羅する `notifyAllowed` のテストを追加する
- [x] 3.2 `internal/server/ws.go` に `func (h *Hub) notifyAllowed(sessionID string) bool` を実装する。判定順は design.md - Decisions のとおり（`state.enabled=false` → 早期 `true`、`AgentID` 空 / `generic` → `false`、リスト空 → `true`、リスト照合）
- [x] 3.3 `broadcastNotify()` を、抑制時もフレームを送りつつ `banner: false` を付ける形に変更する。抑制されたイベントは arbiter を消費しないようにする
- [x] 3.4 `onAgentSnapshot()` の `blocked` 経路にも `notifyAllowed()` を適用し、抑制時は `banner: false` を付けて送る
- [x] 3.5 OSC 経路・`blocked` 経路それぞれで、抑制時にフレームは届くがバナー用フィールドが `false` になることを確かめる server テストを追加する

## 4. プロンプト復帰通知

- [x] 4.1 `internal/server` に、`working` → `idle` で `kind=agent_idle` の notify フレームが 1 回出ること、`none` → `idle` と `blocked` → `idle` では出ないこと、同一 `idle` の再評価で重複しないこと、許可リスト外では `banner: false` になることのテストを追加する
- [x] 4.2 `onAgentSnapshot()` に `working` → `idle` 遷移の検出を追加し、`h.lastAgent` の直前 state を使って遷移元を判定する
- [x] 4.3 プロンプト復帰イベントを既存の arbiter に通し、`kind=agent_idle`、`source=screen`、title に agent display name、body に入力待ちである旨を入れて broadcast する
- [x] 4.4 fake clock を使い、OSC 到着とプロンプト復帰が 4 秒窓内で重なったとき通知が 1 回に収束することを確かめるテストを追加する
- [x] 4.5 `state.enabled=false` のときプロンプト復帰通知が発生しないことをテストで確かめる

## 5. フロントエンド

- [x] 5.1 `web/src/types.ts` の `StateConfig` に `notify_agents: string[]`、`ServerMsg` の `notify` に任意の `kind` / `source` / `banner` を追加する
- [x] 5.2 `web/src/App.tsx` の `DEFAULT_NOTIFICATION_CONFIG` 相当の state 既定値に `notify_agents` を追加する
- [x] 5.3 `notifyAgentWait()` を、`banner === false` のとき未読マークと Dock バッジ更新だけ行い `showNotification()` を呼ばない形に変更する
- [x] 5.4 `web/tests` に、`banner: false` の notify フレームで未読ドットが付きバナーが出ないこと、`banner` を持たないフレームは従来どおり通知することのテストを追加する

## 6. ドキュメントと検証

- [x] 6.1 README の通知セクション（115〜121行付近）に、agent 限定の既定挙動、`agent_idle` 通知、抑制時も未読ドットは付くことを追記する
- [x] 6.2 README の設定表（254行付近）に `state.notify_agents` の行を追加し、既定値と空リストの意味を書く
- [x] 6.3 README のトラブルシューティング表に、`cursor-agent` が思考中に idle 通知を出す場合は `state.quiescence_ms` を上げる旨の行を追加する
- [x] 6.4 `go test ./...` と `cd web && node --test --experimental-strip-types tests/*.test.ts` を実行し、既存の fixture replay と golden テストが無変更で通ることを確かめる
- [x] 6.5 ライブ daemon スモーク: 隔離した HOME / ポートで `webtabinal serve` を起動し、実 PTY セッションに対して ①未識別シェルの OSC 9 が `banner:false` で届く ②`OSC 9;4` / `OSC 9;9` はフレームを出さない ③`generic` が `banner:false` になる ④実行ファイル名 `codex` のプロセスが `working`→`idle` で `kind=agent_idle` / `title=Codex` / banner フラグなしの通知を 1 回だけ出す、を確認する
- [ ] 6.6 ユーザーによる実機確認: 実際の `claude` / `codex` / `cursor-agent` を WebTabinal 内で起動し、ターン完了でバナーが出ること、`vim` や `npm run build` ではバナーが出ず未読ドットのみになることを確かめる
