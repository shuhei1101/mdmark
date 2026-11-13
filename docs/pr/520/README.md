# ほかのリポジトリと MindStella のワークスペースの文書のマーカーを JSON の記載へ移す

## 概要

mdmark を使用するほかのリポジトリと MindStella のワークスペースの文書のマーカーを、今の書き方（`キー=値`・`+機能`・位置の値）から JSON の記載へ移す。

## 背景

[#478](https://github.com/shuhei1101/mdmark/issues/478) の要望。
[#477](https://github.com/shuhei1101/mdmark/pull/477)（起点 Issue [#451](https://github.com/shuhei1101/mdmark/issues/451)）で、マーカーの設定を JSON のオブジェクトで記載できるようにし、今の書き方を書き換える移行の手順を追加した。
今の書き方は 1 つのマイナーバージョンの間だけ参照し、[#479](https://github.com/shuhei1101/mdmark/issues/479) で参照する処理を削除するため、それまでにほかのリポジトリの文書も移す。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と、リポジトリごとの終わりの条件 |
