# 差分の表示（左右に並べる見せ方・変更表示のボタンを出さない指定・箇条書きの記号の位置）と map の図・図の指の操作・表の見出し行・狭い幅の目次を改善する

## 概要

利用側のページが差分を左右に並べて出せ、変更表示のボタンとリビジョンの欄を出さずに差分を出せるようにする。
あわせて、差分のブロックの箇条書きの記号の位置・map の図の手順のバーと線のツールチップ・スマートフォンでの図の縦の指の操作・表の見出し行の留まり方・狭い幅の右側の目次の固定の見せ方を修正する。

## 背景

[#791](https://github.com/shuhei1101/mdmark/issues/791) の束。

| Issue | 依頼元・きっかけ |
| --- | --- |
| [#783](https://github.com/shuhei1101/mdmark/issues/783)・[#784](https://github.com/shuhei1101/mdmark/issues/784)・[#786](https://github.com/shuhei1101/mdmark/issues/786) | shuhei1101/mindstella#667 でプレビューの本文の差分を mdmark の機能に置き換えた際の依頼とレビューの指摘 |
| [#785](https://github.com/shuhei1101/mdmark/issues/785)・[#787](https://github.com/shuhei1101/mdmark/issues/787)・[#788](https://github.com/shuhei1101/mdmark/issues/788) | 利用者のコメント（線のツールチップが邪魔・手順のバーの塗りのアニメーションをやめたい・スマートフォンで図の中を縦に動かせない） |
| [#789](https://github.com/shuhei1101/mdmark/issues/789)・[#790](https://github.com/shuhei1101/mdmark/issues/790) | shuhei1101/dev-docs#312 で見つかった表の見出し行の留まり方の不具合と、狭い幅の目次の固定への利用者の指摘 |

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.mark.md) | ライブラリ本体の計画書 |
