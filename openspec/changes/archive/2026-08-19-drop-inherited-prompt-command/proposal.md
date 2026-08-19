## Why

デーモンを別のターミナルエミュレータから起動すると、そのターミナルのシェル統合が export した `PROMPT_COMMAND` が WebTabinal の全セッションに漏れ、毎プロンプトで `bash: command not found: _cmux_prompt_command` が出る。

`internal/session/session.go` の `shellEnv()` はデーモンの環境を `os.Environ()` でそのまま渡す。WebTabinal の bash 統合は既存の `PROMPT_COMMAND` を `__webtabinal_rest_prompt` に退避して毎回 `eval` する仕様なので、継承した値を忠実に実行する。しかしその関数を定義する側のシェル統合は WebTabinal の `--rcfile` 経路では一度も source されないため、必ず失敗する。

Finder / Dock から起動したときは launchd 環境で `PROMPT_COMMAND` を持たないため発生しない。ターミナルから `make serve` や `.app` を起動したときだけ再現するため、原因が分かりにくい。

## What Changes

- セッション環境を組み立てるとき、継承した `PROMPT_COMMAND` を除去する。既存のテーマ変数除去と同じキー除外の仕組みに載せる
- ユーザー自身が `.bashrc` / `.bash_profile` で設定する `PROMPT_COMMAND` は影響を受けない。WebTabinal の rcfile がそれらを source した時点で再設定され、bash 統合がこれまでどおり退避・実行する
- README のトラブルシューティング表に、この症状と原因を 1 行追加する

**BREAKING**: なし。`PROMPT_COMMAND` は通常 export されないシェル変数であり、環境変数として届くのは親ターミナルのシェル統合が意図的に export した場合に限られる。

## Capabilities

### New Capabilities

- （なし）

### Modified Capabilities

- `session-pty`: セッション環境から親ターミナルのシェル統合フックを持ち込まないことを定義する

## Impact

- Go daemon: `internal/session/session.go` の `shellEnv()` と環境フィルタ
- Documentation: README のトラブルシューティング表
- スコープ外: `BASH_ENV` / `ENV` / `ZDOTDIR` も同種のリスクを持つが、今回の再現環境では export されておらず実証できていないため含めない。`ZDOTDIR` は WebTabinal 自身が zsh 統合で使っているため、扱うなら個別の検討が必要
