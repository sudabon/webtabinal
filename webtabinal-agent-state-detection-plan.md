# WebTabinal エージェント状態検知モデル 移植計画

**対象リポジトリ**: sudabon/webtabinal
**参照実装**: Herdr のエージェント状態検知(working / blocked / idle)
**版**: Draft v0.1 (2026-08-17)

---

## 1. 背景と動機

WebTabinal の現行のエージェント連携は OSC 9 / OSC 99 / OSC 777 を「エージェント側に送らせる」プッシュ型である。この方式は Codex(`notification_method = "osc9"`)や Claude Code(hooks で `/dev/tty` に OSC 9 を書く)では機能するが、次の構造的な限界がある。

- エージェント側の設定・協力を前提とする。設定漏れ・仕様変更で沈黙する。
- OSC を出力しないエージェントは対応不能。実際に Cursor Agent `2026.08.11-e8db854` は OSC 0 のみ出力するため非対応と検証済み(README 記載)。
- 得られるのは「イベント」(完了した・承認待ちになった)であって「状態」ではない。UI に常時表示できる working / blocked / idle のような状態モデルを構成できない。

Herdr はこれをプル型で解決している。エージェントの画面形状(screen shape)をエージェント種別ごとのマニフェストで判定し、エージェント側の協力なしに idle / working / blocked を導出する。マニフェストは「どのシグナルがどの状態を書く権威を持つか」を宣言し、未知の画面は blocked ではなく idle として扱う(誤検知しても表示と待機にしか影響せず、入力送信や破壊的動作の根拠にはしない)というフェイルセーフ原則を持つ。

本計画は、この検知モデルを WebTabinal の Go デーモンに移植する。

## 2. ゴール / 非ゴール

**ゴール**

- デーモン側で各セッション(タブ)の状態を `none / idle / working / blocked` として常時保持し、UI へリアルタイム配信する。
- Claude Code・Codex を初期対応とし、OSC 非出力の Cursor Agent を画面検知で救済する。
- 状態遷移(特に `→ blocked`)を既存の通知パイプラインに接続し、OSC 依存を「シグナルの一つ」に格下げする(廃止はしない)。
- マニフェストを go:embed でバンドルしつつ、ローカルオーバーライドで即日修正可能にする。

**非ゴール(今回やらない)**

- リモートマニフェスト自動更新(Herdr は herdr.dev から配信するが、WebTabinal はローカルファースト方針のため v1 では見送り。将来 opt-in で検討)。
- `agent wait` / prompt 等の自動化 API・エージェント向けスキル(前段の検討で「今すぐは不要」と判断済み。ただし本計画の状態ストアは購読可能なイベント源として設計し、将来の布石とする)。
- ペイン分割・ワークスペース概念の導入。ロールアップ先は現行のタブ + サイドバーのみ。
- 状態を根拠にした自動入力・自動操作(フェイルセーフ原則により恒久的に非ゴール)。

## 3. 現状資産の棚卸し

移植にあたり、WebTabinal には流用できる資産がすでに多い。

| 資産 | 現状の役割 | 本計画での役割 |
|---|---|---|
| Go デーモンの PTY 管理 | PTY 生成・入出力中継 | 出力ストリームの tee 元 |
| リングバッファ(5 MiB) | スクロールバック供給 | そのまま(画面モデルとは別系統) |
| OSC 9/99/777 パーサ | 通知トリガ | 検知エンジンへの「OSC シグナル」入力に転用 |
| シェル統合(`WEBTABINAL_SESSION_ID` ゲート) | cwd・実行中コマンド・状態の報告 | エージェント同定の補助シグナル(preexec のコマンドライン) |
| 通知パイプライン(macOS 通知 / Web Notification、`notification.always`、待ち通知は `min_duration_ms` 対象外) | イベント通知 | `blocked` 遷移通知の出口として流用 |
| タブ未読ドット | 非アクティブタブの活動表示 | 状態ピルと併存(§8) |
| `scripts/osc9-notification-probe.sh` | 通知経路の切り分け | 同思想の `state-snapshot` サブコマンドを追加(§10) |

決定的に欠けているのは**サーバーサイドの画面モデル**である。現行デーモンは PTY バイト列を xterm.js に中継し、リングバッファに溜めるだけで、「いま画面に何が表示されているか」をデーモン自身は知らない。画面形状検知には VT パーサ + スクリーングリッドをデーモン内に持つ必要があり、これが最大の追加コンポーネントになる(Phase 0)。

フロントエンド(xterm.js)は既に画面バッファを持つため「ブラウザ側で検知してデーモンへ報告する」案も成立するが、採用しない。ウィンドウを閉じてもデーモンとセッションが残るのが WebTabinal の核であり、クライアント不在時に状態が凍結する検知は要件を満たさない。検知は必ずデーモン側で行う。

## 4. 状態モデル定義

```
none    : エージェント未検出(通常のシェル)。シェル統合の実行中コマンド表示をそのまま使う
idle    : エージェントのプロンプトが表示され、入力待ち。人間の注意は不要
working : エージェントがターン実行中(出力が流れている / スピナー・進行表示が画面にある)
blocked : エージェントが停止し、人間の応答を待っている(承認ダイアログ、質問、選択肢)
```

遷移の一般規則(マニフェストで上書き可能):

- `→ blocked` は blocked パターンの一致で**即時**遷移する。解除はパターン消失で行う。
- `working → idle` は「idle パターン一致 **かつ** `quiescence_ms`(既定 1500ms)の出力静止」の両方を要求する(ヒステリシス)。ストリーミング出力の瞬間的な息継ぎで idle に落ちるのを防ぐ。
- 未知の画面形状は **idle** に倒す。blocked の誤検知(偽陽性)は通知スパムになるため、偽陰性側に倒すのが Herdr と同じ判断。
- 状態は表示・通知・(将来の)wait の根拠にのみ使う。デーモンが状態を根拠に PTY へ入力を送ることは実装として禁止する。

タブへのロールアップは `blocked > working > idle > none` の優先度で行う(現行はタブ=1セッションだが、将来分割を入れた場合の集約規則として先に定義しておく)。

## 5. シグナル源と権威(signal authority)

Herdr 設計の核心は「エージェントを見えるかどうかではなく、**どのシグナルが idle/working/blocked を書く権威を持つか**」をマニフェストで決める点にある。WebTabinal では 5 系統のシグナルを定義する。

| シグナル | 取得方法 | 既定の権威 |
|---|---|---|
| S1: 画面パターン | VT スクリーングリッドの下端 K 行(既定 15 行、アクティブバッファ=alt screen 優先)への正規表現評価 | idle / blocked / working すべて |
| S2: 出力アクティビティ | PTY 出力のスライディングウィンドウ(bytes/sec、last_output_at) | working の補助、quiescence 判定 |
| S3: OSC 9 / 99 / 777 | 既存パーサ | 「完了イベント」の補強。マニフェストで `osc_authoritative: true` の場合、idle 遷移を早める |
| S4: シェル統合 | preexec/precmd 報告 | `none` 状態の実行中コマンド表示、エージェント起動の一次検出 |
| S5: フォアグラウンドプロセス | `tcgetpgrp(3)` + libproc(macOS)でプロセス名解決 | エージェント種別の同定(S4 の裏取り) |

エージェント同定は S4(コマンドラインに `claude` / `codex` / `cursor-agent` 等)を一次、S5 を裏取りとし、マニフェストの `match.executables` に照合する。パイプ経由やラッパースクリプト起動で S4 が曖昧な場合に S5 が効く。

## 6. Phase 0: サーバーサイド画面モデル

Go でヘッドレス VT エミュレータをデーモンに組み込み、PTY 読み取りパスで tee する。

**候補ライブラリ**(選定は Phase 0 冒頭のスパイクで実施):

- `charmbracelet/x/vt` — 比較的新しく活発。alt screen・モード対応の確認が必要
- `hinshun/vt10x` — expect 系ツールでの実績あり。メンテ状況の確認が必要
- 自前実装 — xterm.js のパーサ仕様をリファレンスにできるが、工数対効果から最終手段

**選定の必須要件**:

1. alt screen(DECSET 1049)の独立バッファ保持と、アクティブバッファの識別 API。Claude Code / Codex / Cursor Agent の TUI は alt screen で動くため、これがないと検知対象の画面が読めない。
2. wcwidth / East Asian Width の正確な取り扱い。日本語環境での列位置ズレはパターンの列アンカーを壊す(当面パターンは行単位の正規表現に留め、列依存を避ける方針だが、グリッド自体の正しさは必要)。
3. リサイズ(SIGWINCH 追随)とリフロー時の一貫性。
4. スクロールリージョン(DECSTBM)対応。

**性能予算**: VT 更新は出力バイト数に対して O(n) であり、既存のリングバッファ書き込みと同じパスに乗せる。ルール評価は出力に対して 120ms のトレーリングデバウンスで起動し、下端 K 行のみを事前コンパイル済み正規表現セットに通す。セッションあたりの追加メモリはグリッド(rows × cols × セル)+ alt バッファで、80×24〜200×60 想定なら数百 KiB オーダー。10 セッション常駐でも問題にならない見込みだが、Phase 0 の受け入れ基準に計測を含める。

## 7. マニフェスト仕様

JSON でバンドル(go:embed)し、`~/Library/Application Support/WebTabinal/manifests/<id>.json` のローカルオーバーライドが常に勝つ。Herdr の「local override always wins」を踏襲し、remote 層は v1 では持たない。

```jsonc
{
  "id": "claude",
  "display_name": "Claude Code",
  "schema_version": 1,
  "match": {
    "executables": ["claude"],
    "command_patterns": ["(^|/)claude(\\s|$)"]
  },
  "screen": {
    "bottom_lines": 15,
    "buffer": "active",              // active | alt | primary
    "states": {
      // ↓ パターンはすべて【仮】。Phase 1 のフィクスチャ採取で確定する
      "blocked": [
        "Do you want to",             // 承認ダイアログ(仮)
        "❯\\s+1\\.",                 // 番号付き選択肢(仮)
        "waiting for (your )?input"   // (仮)
      ],
      "working": [
        "esc to interrupt",           // ターン実行中の表示(仮)
        "[⠁⠂⠄⡀⢀⠠⠐⠈]"                // Braille スピナー(仮)
      ],
      "idle": [
        "^\\s*>\\s*$"                 // 入力プロンプト(仮)
      ]
    }
  },
  "authority": {
    "blocked": ["screen"],
    "working": ["screen", "activity"],
    "idle":    ["screen+quiescence", "osc"]
  },
  "osc_authoritative": true,          // OSC 9 完了イベントで idle 遷移を前倒し
  "quiescence_ms": 1500,
  "verified_against": ["<エージェントのバージョンをフィクスチャ採取時に記録>"],
  "notes": "パターン変更時は tests/fixtures/claude/ を再採取すること"
}
```

設計上の注意:

- **パターンは本計画書の時点ではすべて仮置き**である。README が Cursor Agent をバージョン付きで検証・記録しているのと同じ規律で、実バージョンのフィクスチャからパターンを確定し、`verified_against` に記録する。エージェント TUI の文言はバージョンで変わる前提に立つ。
- `generic` マニフェストを 1 つ用意し、種別を同定できたが専用マニフェストがないエージェント、および同定できないフルスクリーン TUI に適用する。generic は S2(アクティビティ)のみで working/idle を導出し、blocked を**出さない**(未知 → idle 原則の具体化)。
- スキーマには `schema_version` を持たせ、将来のリモート配信 opt-in の際に互換判定に使う。

## 8. UI と通知の統合

**サイドバー / タブ**: 未読ドットの隣に状態ピルを追加する。`working` はスピナー(または回転アニメーション)、`blocked` は注意色(赤系)+ タブを一覧上位に寄せるオプション、`idle` は控えめな表示、`none` は非表示(従来どおり実行中コマンドを表示)。色はエージェント種別ではなく状態を表す。

**通知**: 状態エンジンからの `→ blocked` 遷移を、既存の OSC 9 受信と同じ通知パイプラインに `agent_blocked` イベントとして流す。README の現行仕様「待ち通知は `notification.min_duration_ms` の対象外」と整合させ、`agent_blocked` も対象外とする。`notification.always` の意味論(前面アクティブタブでの表示可否)もそのまま適用する。OSC 9 由来の通知と画面検知由来の通知が同一事象で重複しうるため、セッション単位で 3〜5 秒のデデュープウィンドウを設ける。

**WS プロトコル拡張**(クライアント向け push):

```json
{
  "type": "session_state_changed",
  "session_id": "…",
  "agent": "claude",
  "state": "blocked",
  "since": "2026-08-17T12:34:56+09:00",
  "signal": "screen",
  "detail": "matched: Do you want to"
}
```

`detail` はデバッグ表示用で、UI 既定では非表示。状態はクライアント接続時のスナップショット(既存のセッション一覧応答)にも含め、リロード直後から正しいピルが出るようにする。

**設定キー追加**(config.json):

```
state.enabled            = true
state.debounce_ms        = 120
state.quiescence_ms      = 1500     // マニフェスト側が優先
state.bottom_lines       = 15       // 同上
state.notify_on_blocked  = true
state.manifest_dir       = ""       // 空ならデフォルトパス
```

## 9. 実装フェーズ(openspec チェンジ分割案)

openspec のチェンジチケットとして 4 分割する。各チェンジは独立にレビュー・マージ可能な粒度とする。

### change 1: `add-vt-screen-model`

デーモン内ヘッドレス VT。`internal/vtscreen`(仮)として、PTY 出力の tee、グリッド保持、alt screen、リサイズ追随、下端 K 行のスナップショット API を提供する。検知ロジックは含まない。

受け入れ基準:

- [ ] vim / less 等の alt screen アプリで、下端行スナップショットが実画面と一致する(フィクスチャ比較)
- [ ] 日本語混在出力で列崩れなくグリッドが構築される
- [ ] リサイズ後 500ms 以内にグリッド寸法が追随する
- [ ] 1 セッションあたりの追加常駐メモリ実測値をドキュメント化(目安 < 1 MiB/セッション)
- [ ] `cat` で大出力(100 MB)を流しても中継レイテンシの体感劣化がない(デバウンス外のホットパスに重い処理を置かない)

### change 2: `add-agent-state-engine`

`internal/agentdetect`(仮)。マニフェストローダ(embed + ローカルオーバーライド)、シグナル統合(S1〜S5)、状態機械、`session_state_changed` の内部イベントバス。マニフェストは `claude` / `codex` / `generic` の 3 つ。エージェント同定(S4 一次 + S5 裏取り)を含む。

受け入れ基準:

- [ ] フィクスチャ再生テストで claude / codex の idle / working / blocked が期待どおり判定される(§10)
- [ ] generic 適用時に blocked が発生しない
- [ ] 未知画面 → idle のフェイルセーフがテストで担保される
- [ ] ローカルオーバーライドの JSON を置くと、デーモン再起動なし(または再起動のみ、どちらを仕様とするか本チェンジで決定)で反映される
- [ ] 状態を根拠に PTY 書き込みを行う API が存在しない(コードレビュー観点として明記)

### change 3: `add-state-ui-and-notifications`

WS プロトコル拡張、サイドバー状態ピル、`→ blocked` 通知、デデュープ、設定 UI(設定 → 通知への項目追加)、スナップショット同期。

受け入れ基準:

- [ ] ウィンドウを閉じてデーモンのみの状態でも、再接続時に現在状態が即時表示される
- [ ] Codex の OSC 9 と画面検知が同時に発火しても通知は 1 回
- [ ] `notification.always` / `min_duration_ms` の既存意味論と矛盾しない(README の表を更新)

### change 4: `add-cursor-manifest-and-fixture-harness`

Cursor Agent マニフェスト(本移植の当初動機)、フィクスチャ採取ツール、状態スナップショットコマンド。README の通知セクションに「Cursor Agent は画面検知で対応」と追記し、OSC 非対応の記述を更新する。

受け入れ基準:

- [ ] 検証した Cursor Agent のバージョンを `verified_against` と README に記録
- [ ] `webtabinal state snapshot <session>` が下端 K 行とマッチ結果をダンプする(マニフェスト作成・切り分け用。osc9 プローブと同じ思想)
- [ ] `scripts/record-agent-fixture.sh` で PTY 生ストリームを採取し、ゴールデンテストに投入できる

## 10. テスト戦略

**フィクスチャ駆動を唯一の真実とする。** 各エージェント × 各状態の PTY 生バイトストリームを採取し(`script(1)` ベースの採取スクリプト)、`tests/fixtures/<agent>/<state>-<version>.raw` として保存する。テストはフィクスチャを VT モデルに再生 → 検知エンジンに通す → 期待状態列(遷移のタイムライン)と比較するゴールデン方式。

- エージェントのバージョン更新時はフィクスチャを再採取し、`verified_against` を更新する運用を CONTRIBUTING に明記する。
- 遷移規則(ヒステリシス、即時 blocked、未知→idle)はフィクスチャに依存しないプロパティテストでも担保する。
- 実エージェントを起動する E2E は CI では行わない(API キー・非決定性のため)。ローカルの `make e2e-state` として任意実行に留める。

## 11. リスクと緩和

| リスク | 影響 | 緩和 |
|---|---|---|
| エージェント TUI の文言・レイアウト変更 | パターン失効 → 状態が idle に張り付く | 未知→idle 原則で安全側に壊れる設計。ローカルオーバーライドで即日修正。`state snapshot` で利用者自身が切り分け可能 |
| VT エミュレーションの互換不足(特殊シーケンス) | グリッド崩れ → 誤判定 | 選定スパイクで実エージェント 3 種の出力を通す。崩れは detail ログに残し、generic フォールバック |
| blocked 偽陽性による通知スパム | 信頼失墜(通知が狼少年化) | blocked パターンは保守的に(確度の高い文言のみ)。デデュープ + フィクスチャでの回帰防止 |
| 性能(常駐 CPU/メモリ増) | 体感劣化 | デバウンス評価、下端 K 行限定、change 1 で実測を受け入れ基準化 |
| CJK 幅・IME 由来の列ズレ | パターン不一致 | 行単位正規表現に限定し列アンカーを使わない。グリッドの幅計算はライブラリ選定要件に含める |
| OSC 経路との二重管理 | 仕様の分裂 | OSC を authority モデル内の一シグナルに位置づけ、README の通知ドキュメントを本機能側に統合 |

## 12. 未解決の設計判断(実装前に決める)

1. ローカルオーバーライドの反映タイミング: fsnotify でホットリロードするか、デーモン再起動を要求するか。ホットリロードは Herdr(再起動なし適用)に寄せられるが、v1 の複雑性を上げる。
2. `none`(通常シェル)状態と既存シェル統合表示の統合方法: 状態ピルとコマンド表示を同一コンポーネントにするか、併置か。
3. 状態履歴の保持: 直近 N 遷移をデーモンが持つか(将来の wait API・デバッグに有用だが v1 では表示用途がない)。
4. `working` の generic 判定閾値: bytes/sec の下限と静止判定の窓幅。フィクスチャ採取後にチューニング。

## 13. 参考資料

- Herdr: supported agents / 検知とマニフェストの原則 — https://herdr.dev/docs/agents/
- Herdr: integrations(状態は画面検知、同一性はフック報告という分離) — https://herdr.dev/docs/integrations/
- Herdr: socket API(将来の wait / 購読の布石として) — https://herdr.dev/docs/socket-api/
- Herdr リポジトリ(`src/detect/`, `src/terminal/` の構成) — https://github.com/herdrdev/herdr
- WebTabinal README(OSC 9/99/777 経路、Cursor Agent 検証記録、通知セマンティクス) — https://github.com/sudabon/webtabinal
