# mdmark のリポジトリの文書（docs/mock・docs/pr・docs/design-policy.md）のマーカーを JSON の記載へ移す

## 概要

mdmark のリポジトリの文書（`docs/mock/`・`docs/pr/`・`docs/design-policy.md`）の今の書き方のマーカーを JSON の記載へ書き換え、`mdmark check` が `legacy_mark` を出さない状態にする。

## 背景

[mdmark のリポジトリのほかの文書（docs/mock など）のマーカーを JSON の記載へ移す](https://github.com/shuhei1101/mdmark/issues/481) の要望。
[マーカーの設定を JSON で記載できるようにし、マーカーごとに設定の設計書を置く](https://github.com/shuhei1101/mdmark/pull/477)（起点 Issue [マーカーの設定を JSON で記載できるようにし、マーカーごとに設定の設計書を置く](https://github.com/shuhei1101/mdmark/issues/451)）でマーカーの設定を JSON のオブジェクトで記載できるようにし、設計書・使い方集・雛形を書き換えた。
今の書き方（`キー=値`・`+機能`・位置の値）は 1 つのマイナーバージョンの間だけ参照し、[マーカーの今の書き方を読む処理を削除する（次のマイナーバージョンの破壊的変更）](https://github.com/shuhei1101/mdmark/issues/479) で参照する処理を削除するため、それまでにリポジトリの残りの文書を移す。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と、書き換える文書の一覧 |
