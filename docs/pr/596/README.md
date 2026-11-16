# map で classDiagram・architecture-beta・C4Context の Mermaid を、ER 図・状態遷移図と同じ記載方法と操作で描く

## 概要

文書の作成者が、map の範囲に classDiagram・architecture-beta・C4Context の Mermaid と補足を記載し、flowchart・シーケンス図・ER 図・状態遷移図と同じマーカー・補足・操作で描ける。

## 背景

[Issue #564](https://github.com/shuhei1101/mdmark/issues/564) の要望。
[Issue #465](https://github.com/shuhei1101/mdmark/issues/465) の一案のとおり種類ごとに分けて作り、作業 PR [#531](https://github.com/shuhei1101/mdmark/pull/531) で erDiagram・stateDiagram-v2 と、種類に依らない共通の部分（構成図の描画と操作への差し込み `MapFlowExtension`・部品で描く経路）を作った。
この Issue は [map で erDiagram・stateDiagram-v2 の Mermaid を、flowchart・シーケンス図と同じ記載方法と操作で描く](https://github.com/shuhei1101/mdmark/pull/531) のスコープ外の行（残りの種類）から切り出した。
今の map は、これらの種類をコードブロックのまま表示する。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
