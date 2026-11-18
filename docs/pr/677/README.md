# map の C4Dynamic の番号つきの関係を番号の順に手順のバーで再生する

## 概要

読者が、map の C4Dynamic の番号つきの関係を、番号の順に手順のバーで 1 本ずつ選んで繰り返し再生できる。

## 背景

束の親 Issue [拡大した図にミニマップを追加し、map の C4Dynamic の番号つきの関係を番号の順に手順のバーで再生する](https://github.com/shuhei1101/mdmark/issues/676) の要望のうち、次の 1 件を扱う。

- [map の C4Dynamic の番号つきの関係を、番号の順に手順のバーで再生する](https://github.com/shuhei1101/mdmark/issues/670)

束のもう 1 件の [拡大した図に、全体の中の今の位置を示すミニマップを追加する](https://github.com/shuhei1101/mdmark/issues/604) は、モックの確認でユーザーがミニマップは要らないと判断したため、スコープから外した（[確認のスレッド](https://github.com/shuhei1101/mdmark/pull/677#discussion_r4615263791)）。

#670 は、[#658](https://github.com/shuhei1101/mdmark/issues/658) の作業 PR [#660](https://github.com/shuhei1101/mdmark/pull/660) のスコープ外から切り出した後続である。
#660 は map の `C4Dynamic` を描けるようにしたが、番号つきの関係（`Rel`・`RelIndex`）は線のラベルの前に「{番号}: 」を出すだけで、再生しない。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
