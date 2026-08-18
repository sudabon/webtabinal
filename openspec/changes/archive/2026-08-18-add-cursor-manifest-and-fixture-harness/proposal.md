## Why

Cursor Agent は確認済みバージョンで OSC 9 / 99 / 777 を出さず、今回の画面検知移植の主要な対象である。一方、TUI の文言や形状はバージョンごとに変わるため、実出力から manifest を確定し、利用者が失効原因を診断できる再現可能な fixture / snapshot workflow が必要である。

## What Changes

- 実際の Cursor Agent PTY fixture から保守的な `cursor-agent` manifest を作成し、検証バージョンを `verified_against` に記録する
- `script(1)` を利用する fixture recording script と、raw stream・期待遷移 metadata の versioned directory convention を追加する
- fixture を VT model と agent state engine に replay する golden test harness を追加し、Claude Code / Codex / Cursor Agent の状態別回帰 fixture を管理する
- `webtabinal state snapshot <session-id>` を追加し、daemon から active buffer の下端 K 行、agent identity、現在状態、manifest pattern の match 結果を取得して表示する
- snapshot 用の loopback-only authenticated diagnostic API を追加する。API と CLI は読み取り専用とし、PTY input や状態変更機能を持たせない
- `make e2e-state` を任意の local-only 検証として追加し、CI では API key を要する実 agent を起動しない
- README / CONTRIBUTING の Cursor 対応表、fixture 再採取、manifest 更新、troubleshooting 手順を更新する

## Capabilities

### New Capabilities

- `cursor-agent-detection`: versioned fixture で検証された Cursor Agent manifest と、安全側の状態判定契約
- `agent-state-fixtures`: PTY fixture の採取・保存・replay・更新、および state snapshot 診断の契約

### Modified Capabilities

- `daemon-core`: CLI に読み取り専用の `state snapshot` subcommand を追加する
- `transport-api`: state snapshot CLI が利用する authenticated diagnostic endpoint を追加する

## Impact

- Go daemon / CLI: `cmd/webtabinal`、agent detection diagnostics、loopback REST handler
- Tooling: `scripts/record-agent-fixture.sh`、Makefile、raw fixtures / expected timelines、golden tests
- Embedded assets: Cursor Agent manifest と検証 metadata
- Documentation: README の Cursor Agent support 記述、CONTRIBUTING の fixture maintenance workflow
- Compatibility and safety: diagnostic surface は既存 loopback Host / Origin / token protectionを再利用し、読み取り専用とする
- Dependencies: `add-vt-screen-model` と `add-agent-state-engine` が先に必要
