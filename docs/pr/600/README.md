# map の図の説明のツールチップに features.hints と tooltips.diagramPlacement を適用し、ビューの表の長文の列の並べ替えの既定を決める

## 概要

文書の作成者が、設定の `features.hints` と `tooltips.diagramPlacement` で map の図の説明のツールチップを出す・出さない・出す場所を切り替えられるようにする。
ビューのマーカーの表にも、長文の列に並べ替えを既定で付けない既定を当てるかを決め、当てる場合は `columns.{列名}.sort` で付け外しできるようにする。

## 背景

[描いた文書の表示の改善 2 件（map の図の説明のツールチップに features.hints と tooltips.diagramPlacement を適用する・ビューの表の長文の列に並べ替えを既定で付けないかを決める）](https://github.com/shuhei1101/mdmark/issues/593) は次の 2 件の束。

- [map の図の説明のツールチップに、設定の features.hints と tooltips.diagramPlacement を適用する](https://github.com/shuhei1101/mdmark/issues/557): flow の廃止（[今の flow・sequence の定義を map へ変換するスクリプトを用意し、flow・sequence を廃止する](https://github.com/shuhei1101/mdmark/pull/534)）で、2 つの設定が効く図は ER 図・グラフ・埋め込んだ HTML の `data-hint` だけになった。`src/map/flow-view.ts` と `src/map/sequence-view.ts` は `placement: "bottom"` で固定し、`notes` のツールチップを常に描く
- [ビューのマーカーの表でも、長文の列に並べ替えを既定で付けず、columns.{列名}.sort で付け外しできるようにするかを決める](https://github.com/shuhei1101/mdmark/issues/561): [比較中に右側の目次の変わったセクションにマーカーを出し、長文の列に表の並べ替えを既定で付けない](https://github.com/shuhei1101/mdmark/pull/550) で表のマーカーの長文の列（`data-long`）に並べ替えを既定で付けないようにしたが、ビューのマーカーの表は `columns.{列名}` から `filter` だけを読み、全ての列に並べ替えを付けたまま

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
