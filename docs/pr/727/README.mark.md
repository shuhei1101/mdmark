# 表の列の幅の計測で DOM の書き換えと幅の読み取りを交互にせず、表の多い文書を描いても画面を止めないようにする

## 概要

表の多い文書（表 16 個・セル 459 個）を描いても、表の列の幅を決める処理で画面が止まらないようにする。

## 背景

[Issue #725](https://github.com/shuhei1101/mdmark/issues/725) の要望。MindStella の画面で資料を切り替えるたびに、表の列の幅の計測（`src/table/table-width.interact.ts` の `measureColumns`）でメインスレッドが 15〜16 秒止まり、利用者の作業が止まっている（元の報告は [shuhei1101/mindstella#627](https://github.com/shuhei1101/mindstella/issues/627)）。

列の幅の自動計算は [#505](https://github.com/shuhei1101/mdmark/pull/505) で入った。`textWidth` が、セルの行・半角の単語ごとに計測用の `span` を足し、幅を読み、消すため、読み取りのたびにブラウザがレイアウトを計算し直す。セルごとの `getComputedStyle`（`paddingOf`）も時間を占める。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.mark.md) | ライブラリ本体の計画書 |
