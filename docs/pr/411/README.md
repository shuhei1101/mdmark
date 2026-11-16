# 表の操作の E2E 9 件の fail（結合した見出しの絞り込みのボタン・並べ替えの順・ピン止め・はみ出しと幅）を修正する

## 概要

Sprint v0.10.0 の E2E で fail した単一ユースケース『表を操作する』の 9 件を、設計と食い違っている側（テスト・シナリオの準備、または実装）で修正し、release で pass させる。

## 背景

[Issue #399](https://github.com/shuhei1101/mdmark/issues/399) の要望。
Sprint v0.10.0 の E2E（[#255](https://github.com/shuhei1101/mdmark/issues/255)、release PR [#393](https://github.com/shuhei1101/mdmark/pull/393)）で 9 件が fail した。
後から入った PR（[既存の記法・点検への項目の追加 6 件（グラフの種類・表のセルの結合・図の定義の点検・タブの入れ子・注意書きのタイトル・コードの折りたたみ）](https://github.com/shuhei1101/mdmark/pull/275)・[はみ出す表は既定で先頭の列をピン止めし、pin=・wide= と真偽値の ✓ 表示を追加する](https://github.com/shuhei1101/mdmark/pull/283)・[既存の記法への項目の追加 3 件（表の列の並べ替え・コードブロックの HTML の TypeScript と CSS・表のキーの階層）](https://github.com/shuhei1101/mdmark/pull/303)・[記法の新設 8 件（icon:・columns・蛍光ペン・kbd: と ruby・details と pagebreak・include・wide・csv の表）](https://github.com/shuhei1101/mdmark/pull/307)・[描いた文書の表示を改善する（グラフの値のツールチップ・表の幅・図の高さのハンドル・表の列のボタン・構成図の見直し）](https://github.com/shuhei1101/mdmark/pull/308)）が追加したテストが、並べ替えの順・絞り込みのボタンを付ける列・横にスクロールする要素について、今の実装と違う前提で記載されている。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | 単一ユースケース『表を操作する』のシナリオと E2E 9 件の計画書 |
