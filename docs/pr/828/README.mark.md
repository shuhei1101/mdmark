# DOM に取り付ける前に描いた表の列の幅のつまみの aria-valuemin・aria-valuenow・aria-valuemax を、取り付けた後と窓の幅が変わった後に有限の値で更新する

## 概要

利用側が document に取り付ける前の要素へ `mount` で表を描いても、取り付けた後の列の幅のつまみが今の幅・最小幅・上限を有限の値で支援技術へ伝えるようになる。

## 背景

[Issue #827](https://github.com/shuhei1101/mdmark/issues/827) の要望。
document に取り付ける前の要素へ `features.table` の表を描くと、列の幅のつまみ（`span.mdmark-col-resize`）が `aria-valuemin="NaN"`・`aria-valuenow="0"`・`aria-valuemax="0"` のまま残り、axe-core の `aria-valid-attr-value` が出る。
[src/table/table-resize.interact.ts](https://github.com/shuhei1101/mdmark/blob/a40a8fed/src/table/table-resize.interact.ts#L155) の `updateValues` は、配置の無い時点の `offsetWidth`（0）と `minWidthOf`（`getComputedStyle` の余白・罫線が空文字で `NaN`）をそのまま入れ、その後は操作するまで入れ直さない。
[#686](https://github.com/shuhei1101/mdmark/issues/686)（[#707](https://github.com/shuhei1101/mdmark/pull/707)）は配置のある表で `min ≤ now ≤ max` を保つ修正で、配置の無いときの `NaN` は扱っていない。
mindstella のプレビュー（[shuhei1101/mindstella#714](https://github.com/shuhei1101/mindstella/issues/714)）は本文を document の外の要素に描いてから配置するため、全ての表で検出が出る。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.mark.md) | ライブラリ本体の計画書（列の幅のつまみの値を入れる時点と値の決め方） |
