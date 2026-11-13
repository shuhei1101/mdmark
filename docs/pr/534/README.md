# 今の flow・sequence の定義を map へ変換するスクリプトを用意し、flow・sequence を廃止する

## 概要

文書の作成者が、座標を記載した JSON の `flow`（フロー図）・`sequence`（シーケンス図）の定義を、map（Mermaid と補足の JSON で書く図）の範囲へ変換できる。
変換を用意した後に `flow`・`sequence` を廃止する。

## 背景

[#467](https://github.com/shuhei1101/mdmark/issues/467) の要望。
[#445](https://github.com/shuhei1101/mdmark/pull/445)（[#324](https://github.com/shuhei1101/mdmark/issues/324) の作業 PR）で map を追加し、[#464](https://github.com/shuhei1101/mdmark/issues/464) で map のシーケンス図に loop・alt の枠などを追加した。
#445 では今の `flow`・`sequence` を残し、資料 A-38 の「廃止の進め方」で、変換のスクリプトを用意してから廃止するとしていた（#445 の要件.yaml のスコープ外）。
[#290](https://github.com/shuhei1101/mdmark/issues/290)（既存の文書の図を map へ移行する）は、この変換を使う側にあたる。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
