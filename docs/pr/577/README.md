# 図の枠のリサイズハンドルに描いた直後から必須の ARIA 属性を持たせ、map の構成図の説明を持つノードのフォーカスできる要素の入れ子を解消する

## 概要

スクリーンリーダーの利用者が、描いた直後の図の枠のリサイズハンドルで高さの値を読み取れ、map の構成図の説明を持つノードと説明のマーカーを入れ子にならない要素として操作できるようになる。

## 背景

束の親 Issue [#576](https://github.com/shuhei1101/mdmark/issues/576) の要望で、子 Issue [#514](https://github.com/shuhei1101/mdmark/issues/514)・[#558](https://github.com/shuhei1101/mdmark/issues/558) を 1 つの作業 PR で進める。
#514 は、[#508](https://github.com/shuhei1101/mdmark/pull/508) のレビューで、ストーリー `Parts/DiagramFrame` の `Zoomed` に axe の `aria-required-attr` が出ると報告された対象外の逸脱による。`aria-valuenow` などは `mount` の `attachDiagramResize` が付けるだけで、`render` の HTML には無い。
#558 は、[#534](https://github.com/shuhei1101/mdmark/pull/534) のレビューで、ストーリー `parts-mapflow--default` の説明を持つノードに axe の `nested-interactive` が出ると報告された対象外の逸脱による。#534 はリンク先を持つノードの入れ子だけを解消した。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
