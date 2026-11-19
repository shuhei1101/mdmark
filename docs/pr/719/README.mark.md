# map の構成図・状態遷移図で、折り返したノードの名前がノードに収まる大きさにする

## 概要

map の構成図・状態遷移図で、ノードの名前が折り返しても、名前の最後の行がノードの下の余白に食い込まずにノードの中に収まるようにする。

## 背景

[Issue #718](https://github.com/shuhei1101/mdmark/issues/718) の要望。[PR #717](https://github.com/shuhei1101/mdmark/pull/717)（起点 [Issue #704](https://github.com/shuhei1101/mdmark/issues/704)）のモジュール構成設計のレビューで、クラス図のノートと同じ原因が構成図・状態遷移図のノードにもあると分かり、スコープ外として起票した。

`src/map/layout.ts` の `sizeLeaf` は、名前の幅を左右とも `LABEL_METRICS.padX`（10px）の余白で見積もる。
描画では map のノードは右上の i と開閉の山形の分だけ右を 28px 空ける（`src/index.css` の `padding-right: 28px`・`src/map/class-diagram.ts` の `MAP_NODE_PAD_RIGHT`）。
#717 はクラス図のノートだけを `classPartInputs` の大きさの上書きで修正し、`layout.ts` に `textWidth`・`splitLines` の公開と `leafHeight` を追加した。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.mark.md) | ライブラリ本体の計画書 |
