# 差分のパネルとブロックの色分けで、空行の一致による誤った判定を修正する

## 概要

差分のパネルで変えていない段落を削除と追加の対で出さないようにし、ブロックの色分けで空行を追加して段落を 2 つに分けた変更を追加と判定するようにする。

## 背景

束の親 Issue [#426](https://github.com/shuhei1101/mdmark/issues/426) の子 Issue [#336](https://github.com/shuhei1101/mdmark/issues/336)・[#337](https://github.com/shuhei1101/mdmark/issues/337) の不具合。どちらも [PR #335](https://github.com/shuhei1101/mdmark/pull/335)（[#291](https://github.com/shuhei1101/mdmark/issues/291)）のレビューで切り出された。
差分のパネルは `computeDiff` が jsdiff の `diffLines` をそのまま使用するため、1 行の段落だけの文書で空行どうしが一致する並びが選ばれる。
ブロックの色分けは #335 で空白だけの行を除いて比べるようにしたため、空行だけを追加した変更が比較に現れない。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
