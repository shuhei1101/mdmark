# map のクラス図で、2 行に折り返したノートの文がノードに収まる高さにする

## 概要

map のクラス図で、ノート（`note for {クラス} "..."`）の文が折り返して 2 行以上になっても、文がノードの下端で切れずにノードの中に収まるようにする。

## 背景

[Issue #704](https://github.com/shuhei1101/mdmark/issues/704) の要望。[PR #695](https://github.com/shuhei1101/mdmark/pull/695)（起点 [Issue #622](https://github.com/shuhei1101/mdmark/issues/622)）の作業中に、ストーリー `LongMembers`（`検索` クラスに `note for 検索 "絞り込みと期間から結果を返す"` を持つ）で、折り返したノートの 2 行目がノードの下端で切れることを確認した。

`src/map/class-diagram.ts` の `classPartInputs` は、クラスと namespace のノードにだけ大きさの上書き（`overrides`）を入れ、`classes: ["mdmark-memo"]` のノートのノードには入れていない。
#695 はメンバーの行の折り返しと関係のラベルの置き場所を修正し、ノートのノードの大きさは対象外にした。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.mark.md) | ライブラリ本体の計画書 |
