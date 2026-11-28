# マーカーの今の書き方を参照する処理を削除する

## 概要

描く処理と点検が、マーカーの今の書き方（`キー=値`・`+機能`・位置の値）を JSON のオブジェクトへ変換して参照しなくなる。

## 背景

[Issue #479](https://github.com/shuhei1101/mdmark/issues/479) の要望。
[#477](https://github.com/shuhei1101/mdmark/pull/477)（起点 Issue [#451](https://github.com/shuhei1101/mdmark/issues/451)）でマーカーの設定を JSON のオブジェクトで記載できるようにし、今の書き方は #451 の決定で 1 つのマイナーバージョンの間だけ参照すると決めた。
#477 は `v0.11.0` に入り、次のマイナーバージョン `v0.12.0` を過ぎている。
mdmark 自身の文書の移行（[#481](https://github.com/shuhei1101/mdmark/issues/481)）と、ほかのリポジトリの文書の移行（[#478](https://github.com/shuhei1101/mdmark/issues/478) と、リポジトリごとの 13 件の Issue）は全て close している。
`mdmark upgrade` の移行の手順は [migrations/v0.11.0/legacy-marks.js](https://github.com/shuhei1101/mdmark/blob/75017230/migrations/v0.11.0/legacy-marks.js) を参照するため、`src/render/legacy-marks.ts` を削除しても動く。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.mark.md) | ライブラリ本体の計画書（描く処理・点検・ビルドからの今の書き方の処理の削除） |
