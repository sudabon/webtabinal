## Context

セッションは `exec.Command(shell, "-il")` で起動し、basename が `zsh` のときだけ `ApplyZshInjection` が ZDOTDIR を差し替えて OSC 統合を載せる。パーサ（OSC 7 / 133 / 9973）とサイドバー更新はシェル非依存。bash は注入対象外のため `Integrated=false` のまま、CWD はセッション開始時のディレクトリで固定される。

設定 UI から `/opt/homebrew/bin/bash` などを選べるようになったいま、bash でも zsh と同じライブ更新が必要。macOS の `/bin/bash` は 3.2 なので、bash 4+ 専用構文は使えない。

## Goals / Non-Goals

**Goals:**

- basename が `bash` の起動シェルで、ユーザー rc への一行追加なしに OSC 統合が載る
- `cd` でサイドバー CWD が更新され、コマンド実行で command / running / idle / exit が zsh と同じプロトコルで更新される
- `/bin/bash` 3.2 と Homebrew bash 5.x の両方で動く
- 既存の zsh 注入・パーサ・WebSocket 契約は維持する

**Non-Goals:**

- fish / nushell / POSIX sh の統合
- bash 用の別 OSC プロトコル
- 開いているタブへの後付け注入（新しいセッションから）
- デフォルト `shell` を bash に変えること
- ユーザーの `PROMPT_COMMAND` や DEBUG trap を置き換えて消すこと

## Decisions

### 1. プロトコルは zsh と同一の OSC を再利用する

- **選択**: bash スクリプトも OSC 7（CWD）、OSC 133 A/C/D、OSC 9973（base64 コマンド）を出す。Go の `osc.Parser` と `state` 配信は変更しない
- **理由**: サイドバー更新経路は既に動いている。差分は「bash にフックを載せる」だけにする
- **代替案**: bash だけ PWD をデーモンが `lsof` / `proc` で取る → macOS で不安定で、コマンド文字列も取れない

### 2. bash は `-il` ではなく `-i --rcfile <inject>` で起動する

- **選択**: `bash -l` は `--rcfile` を無視する。bash セッションだけ argv を `--rcfile <Application Support>/bash-inject/bashrc -i` にする（macOS の bash 3.2 は GNU long option を short option より前に置く必要がある）。inject rcfile が login 相当の初期化をしたあと `integration.bash` を source する
- **理由**: zsh の ZDOTDIR 差し替えと同じく、ユーザーファイルを改変せずに必ず統合を読める
- **login 相当の読み込み順**（bash の login と同じ）:
  1. `/etc/profile`（存在すれば）
  2. `~/.bash_profile` / `~/.bash_login` / `~/.profile` のうち最初に存在するもの 1 つ
  3. WebTabinal の `integration.bash`
- **やらないこと**: login が読まない `~/.bashrc` をこちらから追加で source しない（従来の `-il` と同じ）。bashrc が必要ならユーザーの profile が source する
- **代替案**: `-il` のまま PTY に `source integration.bash` を打ち込む → プロンプトと競合し、画面に残る。ユーザー snippet 必須 → zsh より劣る UX

### 3. フックは PROMPT_COMMAND + DEBUG trap（bash 3.2 互換）

- **選択**:
  - コマンド開始: DEBUG trap で OSC 9973 と OSC 133;C（既存 DEBUG trap があれば続けて呼ぶ）
  - プロンプト: PROMPT_COMMAND の先頭に関数を足し、OSC 133;D;<exit>、OSC 7、OSC 133;A
  - PROMPT_COMMAND 実行中の DEBUG は無視する（無限ループ防止）
- **PROMPT_COMMAND が配列のとき**（bash 5.1+）: 既存エントリを保存し、PROMPT_COMMAND は自前関数だけにする。保存分は関数内（`in_prompt=1`）で eval し、DEBUG が後段フックをユーザーコマンドと誤認しないようにする
- **PROMPT_COMMAND が文字列のとき**: 同様に置き換えて中で eval する（先頭に `;` で繋ぐ方式は、後段が DEBUG に拾われるので使わない）
- **理由**: bash に zsh の `precmd` / `preexec` / `chpwd` は無い。DEBUG + PROMPT_COMMAND が 3.2 でも使える定番
- **代替案**: bash 4.4 の `PS0` → `/bin/bash` 3.2 で使えない

### 4. ファイル配置と env は zsh 注入に揃える

- **選択**:
  - `~/Library/Application Support/WebTabinal/integration.bash`（OSC 本体、embed）
  - `~/Library/Application Support/WebTabinal/bash-inject/bashrc`（`--rcfile` 用）
  - env: 既存の `WEBTABINAL_SESSION_ID` に加え `WEBTABINAL_INJECTION=1` と `WEBTABINAL_INTEGRATION_PATH`（bash では `integration.bash` のパス）
- **起動時**: 既存の `integration.Write()` が bash 用ファイルも書く。セッション生成時の `ApplyBashInjection` も書き直す（zsh と同じ）
- **ガード**: `WEBTABINAL_SESSION_ID` 未設定なら no-op。`WEBTABINAL_INTEGRATION_LOADED` で二重ロード防止
- **判定**: `filepath.Base(shell) == "bash"` のときだけ適用（`/bin/bash` も `/opt/homebrew/bin/bash` も対象）。zsh 経路は現状維持

### 5. 設定 hint と README を zsh 限定から外す

- **選択**: 「新しいタブから適用」に加え、zsh / bash ではサイドバーの CWD・コマンドがライブ更新されることを短く書く。README のシェル連携も bash を追記
- **理由**: 今回の不具合は「bash を選んだら黙って統合が消える」こと。仕様を UI に出す
- **やらないこと**: シェル種別のラジオや、非対応シェルの保存禁止。fish などは従来どおり ◌ フォールバック

## Risks / Trade-offs

- [DEBUG trap が bash-preexec / oh-my-bash / 別ツールと衝突する] → 既存 trap を保存してチェーンする。PROMPT_COMMAND は先頭に足し、後段が死んでも自前フックは先に走る
- [`PROMPT_COMMAND` に壊れた cmux 関数が残っている] → 先頭挿入なので、後段の `command not found` でも CWD 更新は行われる
- [`-i --rcfile` は厳密な `bash -l` ではない] → inject 側で login ファイルを同じ順に source して近づける。`~/.bashrc` だけしか無い環境は、もともと `-il` でも読まれない
- [bash 3.2 は `-i --rcfile` を `--` として拒否する] → argv は `--rcfile <file> -i` の順にする
- [bash 3.2 と 5.x の PROMPT_COMMAND 型の違い] → 配列なら配列、それ以外は文字列として扱う
- [パスに空白・日本語・`#` が含まれる] → OSC 7 は zsh と同様に percent-encode してから `file://` URL にする。パーサは既存
- [zsh セッションを誤って bash argv にする] → basename 分岐。既存の zsh cwd テストは残す

## Migration Plan

1. コードとテストを入れてデーモンを再起動する。既存 config の `shell` はそのまま
2. すでに bash で開いているタブは再生成するまで未統合のまま（zsh 注入と同じ「新規セッションから」）
3. ロールバック: bash 分岐を外せば旧動作。書き出した `integration.bash` は残っても、`--rcfile` を使わなければ読まれない

## Open Questions

- なし
