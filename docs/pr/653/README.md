# map に gantt・timeline・gitGraph・journey・block-beta の Mermaid を追加し、flowchart の click で id: のリンク先をノードのリンクにする

## 概要

文書の作成者が、map の範囲に gantt・timeline・gitGraph・journey・block-beta の Mermaid と補足を記載し、ほかの種類と同じマーカー・補足・操作で描ける。
map の flowchart の `click` に `id:` のリンク先を記載したノードを、設計で決めた方法でリンクにできる。

## 背景

束の親 Issue [map に gantt・timeline・gitGraph・journey・block-beta の Mermaid を追加し、flowchart の click で id: のリンク先をノードのリンクにする](https://github.com/shuhei1101/mdmark/issues/652) の要望で、次の 3 件を 1 つの作業 PR で扱う。

- [map で gantt・timeline・gitGraph・journey の Mermaid を、時間か記載順の軸に沿った配置と再生で描く](https://github.com/shuhei1101/mdmark/issues/598)
- [map で block-beta の Mermaid を、columns の格子の配置と、ほかの種類と同じ記載方法と操作で描く](https://github.com/shuhei1101/mdmark/issues/599)
- [map の flowchart の click で、id: のリンク先（設計書の ID と項目のパス）をノードのリンクにする](https://github.com/shuhei1101/mdmark/issues/611)

#598・#599 は、[#564](https://github.com/shuhei1101/mdmark/issues/564) の作業 PR [#596](https://github.com/shuhei1101/mdmark/pull/596) のレビュー（[スレッド](https://github.com/shuhei1101/mdmark/pull/596#discussion_r4577892985)）で、今の入れ子の自動配置で描けない種類を配置の処理ごとに切り出した範囲。
今の map はこの 5 種類をコードブロックのまま表示する。
#611 は、[#610](https://github.com/shuhei1101/mdmark/pull/610) でシナリオの flow を map の範囲で囲んだとき、`click {ノード} "id:..."` の 151 件が `map_invalid_value` になった事象。
今の map は、PR [#534](https://github.com/shuhei1101/mdmark/pull/534) の確認ログの決定（`id:` などの参照は利用側が URL に変えてから記載する）で、`id:` のリンク先を許可しない。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
