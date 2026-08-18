## Context

確認済みの Cursor Agent `2026.08.11-e8db854` は OSC 0 の title update だけを出し、WebTabinal が notification として扱う OSC 9 / 99 / 777 を出さない。`add-agent-state-engine` の screen detection で対応できるが、TUI pattern を記憶や計画書の仮文言から作ると false positive と version drift を検出できない。

また daemon 内の screen grid と match result は通常 UI から見えないため、利用者や maintainer が「画面再構築」「agent identity」「manifest pattern」のどこで失敗したかを切り分ける read-only diagnostic が必要である。terminal fixture は prompt、path、command output などの機密情報を含み得るため、採取・review・commit の境界も設計対象になる。

この change は `add-vt-screen-model` と `add-agent-state-engine` の後に実装し、一般的な remote update や agent E2E を CI requirement にはしない。

## Goals / Non-Goals

**Goals:**

- 実 Cursor Agent version の raw PTY fixtures から conservative な bundled manifest を確定する
- Claude Code / Codex / Cursor Agent の versioned fixtures と expected state timeline を deterministic に replay する
- fixture 採取、sanitization、review、manifest `verified_against` 更新を再現可能な workflow にする
- live session の active screen と match diagnostics を authenticated read-only CLI から取得する
- API key を使う E2E を opt-in local target として分離する

**Non-Goals:**

- agent binary / API key の自動 install・設定・CI execution
- raw screen、state history、fixtures の network upload
- remote manifest distribution / auto update
- diagnostic API / CLI からの PTY input、state mutation、manifest edit
- すべての Cursor Agent version への将来互換保証

## Decisions

### 1. Fixture は agent / version / scenario ごとの self-contained directory にする

repository layout は次を基本とする。

```text
tests/fixtures/agents/<agent>/<version>/<scenario>/
  stream.raw
  case.json
  metadata.json
```

`stream.raw` は escape sequence を保持した PTY output bytes で、UTF-8 text への事前変換を行わない。`metadata.json` は agent ID / exact version、scenario、terminal cols / rows、TERM、locale、platform、capture tool version を持つ。`case.json` は raw stream の byte ranges、各 step 後に fake clock を進める milliseconds、期待 agent identity / state / signal の timeline を持つ。これにより wall-clock timing を binary transcript に埋め込まず、quiescence と debounce を deterministic に再生できる。

idle / working / blocked を別 raw file だけで assertion する案は transition ordering と hysteresis を検証できないため、step timeline を採用する。asciinema JSON だけを source of truth にする案は raw PTY bytes の parser regression を隠すため採用しない。

### 2. Recorder は `script(1)` を orchestration し、commit 前 review を必須にする

`scripts/record-agent-fixture.sh` は agent ID、version、scenario、output directory、実行 command を明示的に受け取り、固定した cols / rows と WebTabinal-compatible TERM / UTF-8 locale で `script(1)` を起動する。recording は temporary directory に作り、size limit と metadata validation を通してから指定 destination へ promote する。既存 fixture を上書きする場合は明示 flag を要求する。

script は開始前と終了後に、prompt、repository path、username、token、source code が transcript に残り得ることを警告する。自動 redaction は escape sequence と layout を壊す可能性があるため、maintainer が `state snapshot` と escaped / hex dump を使って review・必要最小限の length-preserving sanitization を行う。fixture へ credentials、private source、個人 path を commit してはならない。CI check は file size、metadata、known secret pattern、absolute home path の basic guard を行うが、人手 review の代替にはしない。

### 3. Golden harness は production VT / detector と fake clock を使う

test harness は各 `case.json` を列挙し、production `vtscreen` adapter と `agentdetect` engine に raw ranges を順番に feed する。step ごとに injected clock / scheduler を進め、expected identity、state、signal、state-change count と optional bottom lines を比較する。real timer、real process table、network、agent binary は使わない。

manifest の `verified_against` に記載された version は少なくとも一つの fixture directory を持たなければならず、fixture metadata の version と一致させる。manifest pattern を変更した PR は影響 agent の golden suite を必ず通す。obsolete fixture は削除せず、新 version directory を追加して regression coverage とする。

### 4. Cursor manifest は fixture evidence から conservative に作る

Cursor Agent 起動は exact executable / command pattern で同定する。working / idle は実 fixture と activity / quiescence で定義し、blocked は approval / question fixture で他 state に現れない高確度 pattern だけを許可する。確証のない pattern は追加せず、unmatched screen は idle-safe にする。

OSC を出さない確認済み version では `osc_authoritative` を false とし、`verified_against` に exact build string を記録する。将来 version で OSC behavior が変わった場合は新 fixture と metadata を追加してから authority を変更する。Cursor pattern を計画書の仮例から先に固定する案は採用しない。

### 5. Snapshot は loopback authenticated REST + thin CLI とする

daemon に次の read-only endpoint を追加する。

```text
GET /api/sessions/{id}/state-snapshot?lines=<1..200>&buffer=active|primary|alternate
```

response は session ID、buffer / dimensions、normalized bottom lines、current agent snapshot、selected manifest / verified versions、state ごとの matched pattern IDs / line indexes、model / detector availability を含む。captured line と regex match substring を daemon log へ書かない。存在しない session は 404、invalid selector / range は 400、unavailable screen は structured 409 response とする。

endpoint は既存 loopback Host / Origin middleware と token auth をそのまま通る。CLI は config から port と private auth token を読み、`Authorization: Bearer` を付けて `127.0.0.1` へ request する。Origin header は送らない。daemon memory を直接読むために shared file や second process attach を導入する案は synchronization と permission surface を増やすため採用しない。

`webtabinal state snapshot <session-id>` は human-readable output を default とし、`--lines`、`--buffer`、automation 用 `--json` を提供する。daemon unavailable、auth failure、unknown session は non-zero exit と actionable stderr にする。command は terminal contents を明示操作した local user の stdout にだけ表示し、files へ自動保存しない。

### 6. Local E2E は fixture generation と release verification に限定する

`make e2e-state AGENT=<id>` は必要な agent binary / credentials が既にある場合だけ明示実行し、version、idle / working / blocked scenario、snapshot output を対話的に確認する。missing binary / credential は明確に skip / fail し、download や config rewrite を行わない。

通常 CI は raw fixture golden tests、manifest validation、CLI / endpoint tests だけを実行する。non-deterministic agent network call と API cost を merge gate にしない。

### 7. Documentation は support claim を fixture version に結び付ける

README の Cursor section は「OSC built-in notification は未対応」だけの記述から、screen detection で検証済みの exact version、state types、fallback、snapshot troubleshooting へ更新する。CONTRIBUTING には capture command、scenario checklist、secret review、golden update、`verified_against` update、old fixture retention を記載する。

support table は「latest」を無条件に保証せず、last verified version と unknown-to-idle behavior を表示する。

## Risks / Trade-offs

- [fixture に secret / private source が残る] → isolated scenario、temporary capture、explicit review checklist、basic secret / home-path CI guard を使う
- [Cursor update で pattern が失効する] → exact `verified_against`、versioned fixtures、snapshot command、local override workflow を使う
- [blocked pattern が広すぎる] → positive blocked fixture だけでなく idle / working negative fixtures へ全 patterns を通す
- [diagnostic endpoint が terminal contents を露出する] → loopback + existing bearer token、bottom-lines limit、read-only response、no logging に限定する
- [binary fixtures が repository を肥大化する] → scenario を最小化し、per-file size limit を設け、full session logs を保存しない
- [BSD / util-linux `script` の差異] → platform detection と normalized output contract を recorder 内に置き、unsupported platform は actionable error にする

## Migration Plan

1. Fixture directory schema、JSON validation、fake-clock golden harness、sanitization checks を追加する
2. Cursor Agent の idle / working / blocked / unknown fixtures を採取・reviewし、manifest と `verified_against` を確定する
3. Diagnostic endpoint と bearer-auth CLI、error / no-log tests を追加する
4. Recording script と optional `make e2e-state` target を追加する
5. Claude Code / Codex fixtures を同じ convention へ揃え、README / CONTRIBUTING を更新する

永続 user data の migration はない。rollback は Cursor manifest、diagnostic route / CLI、tooling を外せばよく、existing sessions と config format は変換不要である。

## Open Questions

- Cursor Agent の exact state patterns と初回 `verified_against` 値は implementation 時の controlled fixture capture で確定する。fixture evidence が得られない state、特に blocked は support claim に含めない。
