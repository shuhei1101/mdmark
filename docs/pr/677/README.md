# 拡大した図にミニマップを追加し、map の C4Dynamic の番号つきの関係を番号の順に手順のバーで再生する

## 概要

読者が、拡大した図で全体の中の今の位置をミニマップで確認し、ミニマップから表示する位置を移せる。
読者が、map の C4Dynamic の番号つきの関係を、番号の順に手順のバーで 1 本ずつ選んで繰り返し再生できる。

## 背景

束の親 Issue [拡大した図にミニマップを追加し、map の C4Dynamic の番号つきの関係を番号の順に手順のバーで再生する](https://github.com/shuhei1101/mdmark/issues/676) の要望で、次の 2 件を 1 つの作業 PR で扱う。

- [拡大した図に、全体の中の今の位置を示すミニマップを追加する](https://github.com/shuhei1101/mdmark/issues/604)
- [map の C4Dynamic の番号つきの関係を、番号の順に手順のバーで再生する](https://github.com/shuhei1101/mdmark/issues/670)

#604 は、図を拡大しているときに全体の中の今の位置が分からないという利用者の依頼と、DynamicArchitectViewer を動かして比べた調査から起票された。
mdmark は差分の表示にはミニマップを持つが、図には無い。
表示の切り替えは、[#602](https://github.com/shuhei1101/mdmark/issues/602)（作業 PR [#659](https://github.com/shuhei1101/mdmark/pull/659)）で図に重ねたボタンのパネルに配置する。

#670 は、[#658](https://github.com/shuhei1101/mdmark/issues/658) の作業 PR [#660](https://github.com/shuhei1101/mdmark/pull/660) のスコープ外から切り出した後続である。
#660 は map の `C4Dynamic` を描けるようにしたが、番号つきの関係（`Rel`・`RelIndex`）は線のラベルの前に「{番号}: 」を出すだけで、再生しない。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
