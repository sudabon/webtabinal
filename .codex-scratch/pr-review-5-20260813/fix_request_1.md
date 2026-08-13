# PRレビュー修正差分の追加修正依頼（iteration 1）

## 制約
- 以下の2件のみを最小変更で修正すること
- 後方互換性を維持し、公開 API を変更しないこと
- 無関係なリファクタリング、コミット、push を行わないこと

## 指摘一覧

### 1. [Must Fix] desktop/Sources/DesktopSupport.swift:30
- 指摘: Foundation の bridge により JSON boolean port が整数 0/1 として受理される。
- 最小修正案: boolean の Core Foundation type を明示的に除外し、`{"port":true}` を invalid とする回帰テストを追加する。

### 2. [Should Fix] desktop/Sources/DesktopSupport.swift:100
- 指摘: raw socket request の `send` が `SIGPIPE` を抑止していない。
- 最小修正案: socket に `SO_NOSIGPIPE` を設定し、失敗時は probe failure とする。
