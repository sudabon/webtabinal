## 1. OSC の終了シグナルを解釈する

- [x] 1.1 `internal/osc/parser.go` に `EventShellExit` を追加し、`9973;exit;<code>` を解釈する。`<code>` が数値なら `ExitCode` に載せ、欠落・非数値ならイベント自体は生成して `ExitCode` は nil のままにする
- [x] 1.2 `9973;` の未知サブタイプが今までどおりイベントを生成せず無視されることを確認する（既存の分岐を壊していないこと）
- [x] 1.3 `internal/osc` にテストを追加: `9973;exit;0` / `9973;exit;130` / `9973;exit` / `9973;bogus;x` の各入力と、シグナルが他のイベント（CWD・cmd start/end・prompt）と混在したストリームでの分割受信

## 2. セッションに終了経路を記録する

- [x] 2.1 `internal/session/session.go` の `Session` に「シェル終了シグナルを受け取った」フラグと「初回プロンプトを観測した」フラグを追加し、`Info` から読めるようにする
- [x] 2.2 `applyEvent` で `EventShellExit` を受けたらシェル終了フラグを立てる。CWD・コマンド・state は変更しない
- [x] 2.3 `applyEvent` の `EventPrompt`（OSC 133;A）でプロンプト観測フラグを立てる。`EventCWD` では立てない（統合スクリプトは rc 読み込み中に OSC 7 を出すため、ここで立てると design.md 決定 4 のルール 2 が無効になる）
- [x] 2.4 テストを追加: シェル終了イベントが state / cwd / command を変えないこと、プロンプト観測フラグが 133;A で立つこと

## 3. 終了直前の出力を取りこぼさない

- [x] 3.1 `readLoop` の終了を通知するチャネルを `Session` に追加し、`readLoop` の return 時にクローズする
- [x] 3.2 `waitLoop` を、`cmd.Wait()` → `done` クローズ → 読み出しドレインの上限付き待ち → `State=exited` と `ExitCode` の確定 → `onExit` の順に組み替える
- [x] 3.3 ドレイン待ちの上限値を定数として切り出し、テストから短縮できるようにする
- [x] 3.4 テストを追加: 終了直前に出力された OSC シグナルが `onExit` の時点で反映されていること、`readLoop` が終わらない場合でも上限時間で `onExit` に進むこと

## 4. タブを閉じる判定を差し替える

- [x] 4.1 `internal/session/manager.go` の `handleExit` を design.md の 5 段判定に置き換える（無効 → プロンプト未到達 → シグナルあり → exit 0 → 残す）
- [x] 4.2 判定ロジックを `handleExit` から純関数として切り出し、セッションの状態と設定値だけを入力にする
- [x] 4.3 テストを追加: (a) シグナルあり・exit 1 で閉じる、(b) シグナルなし・exit 1 で残る、(c) シグナルなし・exit 0 で閉じる、(d) `close_tab_on_clean_exit=false` では常に残る、(e) 統合済みでプロンプト未到達なら exit 0 でも残る、(f) 非統合セッションは exit 0 で閉じ、exit 1 で残る

## 5. シェル統合スクリプトからシグナルを出す

- [x] 5.1 `internal/integration/integration.zsh` に終了ハンドラを追加し、`add-zsh-hook zshexit` で登録する。一度送ったら再送しないガードを入れる
- [x] 5.2 `internal/integration/integration.bash` に終了ハンドラを追加し、`trap -p EXIT` で退避した既存トラップを `eval` で連鎖させたうえで `trap ... EXIT` を張る。一度送ったら再送しないガードを入れる
- [x] 5.3 `internal/integration/integration.go` の `Version` を上げ、起動時に Application Support 配下のスクリプトが上書きされることを確認する
- [x] 5.4 実シェルを起動する統合テストを追加: bash / zsh それぞれで `false` → `exit` と `false` → Ctrl+D の 4 通りについて、シグナルが観測されタブが閉じること
- [x] 5.5 テストを追加: ユーザー定義の `EXIT` トラップ / `zshexit` フックが WebTabinal のハンドラと共存して両方実行されること
- [x] 5.6 テストを追加: `WEBTABINAL_SESSION_ID` が無いシェルではシグナルが出ないこと

## 6. 仕上げ

- [x] 6.1 README の `close_tab_on_clean_exit` の説明を「シェルが自分の意思で終了したときにタブを閉じる（終了コードは問わない。起動に失敗したシェルのタブは残る）」に更新する
- [x] 6.2 `go test ./...` と web のテストを実行して全体が通ることを確認する（web は `test` スクリプトが無いため `node --test --experimental-strip-types tests/*.test.ts`。`npm run lint` / `npm run build` も実行）
- [x] 6.3 デーモンを起動し、bash セッションで `grep` 空振り直後の `exit`、Ctrl+D、正常な `exit` の 3 通りを手動確認する
- [x] 6.4 `openspec validate fix-tab-close-on-shell-exit` が通ることを確認する
