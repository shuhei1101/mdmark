# 今の flow・sequence の定義を map へ変換するスクリプトを用意し、flow・sequence を廃止する

## 概要

文書の作成者が、座標を記載した JSON の `flow`（フロー図）・`sequence`（シーケンス図）の定義を、map（Mermaid と補足の JSON で書く図）の範囲へ変換できる。
変換を用意した後に `flow`・`sequence` を廃止する。

## 背景

[今の flow・sequence の定義を map へ変換するスクリプトを用意し、flow・sequence を廃止する](https://github.com/shuhei1101/mdmark/issues/467) の要望。
[Mermaid と補足で書き、自動配置で描いて階層を辿れる新しい図（map）を追加する](https://github.com/shuhei1101/mdmark/pull/445)（[Mermaid と補足で書き、自動配置で描いて階層を辿れる新しい図（map）を追加する](https://github.com/shuhei1101/mdmark/issues/324) の作業 PR）で map を追加し、[新しい図 map に、シーケンス図の参加者の操作・loop と alt の枠・タッチでのドラッグ・汎用の箱の種類の表示名を追加する](https://github.com/shuhei1101/mdmark/issues/464) で map のシーケンス図に loop・alt の枠などを追加した。
[Mermaid と補足で書き、自動配置で描いて階層を辿れる新しい図（map）を追加する](https://github.com/shuhei1101/mdmark/pull/445) では今の `flow`・`sequence` を残し、資料 A-38 の「廃止の進め方」で、変換のスクリプトを用意してから廃止するとしていた（[Mermaid と補足で書き、自動配置で描いて階層を辿れる新しい図（map）を追加する](https://github.com/shuhei1101/mdmark/pull/445) の要件.yaml のスコープ外）。
[既存の文書を mdmark の書き方と表し方の優先順位（図 → 表 → 箇条書き → 文）に移行する](https://github.com/shuhei1101/mdmark/issues/290)（既存の文書の図を map へ移行する）は、この変換を使う側にあたる。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
