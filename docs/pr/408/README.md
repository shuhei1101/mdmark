# ファイルツリーの .mdmark-tree-row の display: flex をファイルツリーの中に限定し、表のキーの階層の折りたたんだ行と絞り込んだ行を隠す

## 概要

表のキーの階層で、読む人が折りたたんだ行と絞り込みで外れた行が隠れるようにする。

## 背景

[Issue #396](https://github.com/shuhei1101/mdmark/issues/396) の不具合。Sprint v0.10.0 の E2E（[release PR #393](https://github.com/shuhei1101/mdmark/pull/393)）で、表のキーの階層の 4 件が fail した。

ファイルツリーの項目の行に当てる `src/index.css` の `.mdmark .mdmark-tree-row { display: flex }` が、[#303](https://github.com/shuhei1101/mdmark/pull/303) で同じクラス名を付けた表のキーの階層の `<tr>` にも当たる。作者の CSS の `display: flex` が `[hidden]` の UA の `display: none` に勝つため、`hidden` を付けた行が隠れない。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
