# map で mindmap の Mermaid を、根からの木の配置と、ほかの種類と同じ記載方法と操作で描く

## 概要

文書の作成者が、map の範囲に mindmap の Mermaid と補足を記載し、根を中央に置いて枝を外へ広げる木の配置で、flowchart・シーケンス図・ER 図・状態遷移図と同じマーカー・補足・操作で描ける。

## 背景

[map で mindmap の Mermaid を、根からの木の配置と、ほかの種類と同じ記載方法と操作で描く](https://github.com/shuhei1101/mdmark/issues/597) の要望。
[map で classDiagram・mindmap・gantt などの残りの Mermaid の種類を、ER 図・状態遷移図と同じ記載方法と操作で描く](https://github.com/shuhei1101/mdmark/issues/564) の作業 PR [map で classDiagram・architecture-beta・C4Context の Mermaid を、ER 図・状態遷移図と同じ記載方法と操作で描く](https://github.com/shuhei1101/mdmark/pull/596) のレビュー（[スレッド](https://github.com/shuhei1101/mdmark/pull/596#discussion_r4577892985)）で、今の入れ子の自動配置で描けない種類を配置の処理ごとに子の Issue へ切り出した。
この Issue は木の配置を新しく作る mindmap を扱う。
今の map は mindmap をコードブロックのまま表示し、map の範囲の外の mindmap のコードブロックは mermaid のライブラリで描く。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
