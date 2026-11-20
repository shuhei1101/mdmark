# ER-472-2 の補足の関連を列を持たない実体の記載方法に修正し、設計書の検証に合格させる

## 概要

ER 図『map の補足』の関連 4 本を、設計書の検証で違反にならない記載方法に修正する。

## 背景

[Issue #768](https://github.com/shuhei1101/mdmark/issues/768) の要望。[PR #740](https://github.com/shuhei1101/mdmark/pull/740)（[#471](https://github.com/shuhei1101/mdmark/issues/471) の作業 PR）のスコープ外として起票された。

ER 図『map の補足』の関連は、補足から案内の手順・配置の上書き・分類・計画した変更へ `from_column`・`to_column` で列を指す。
テーブル `map_data` は `walkthroughs`・`layout`・`groups`・`changes` を列に持たず、子のテーブルも `index`・`id` を列に持たないため、設計書の検証が 8 件の違反（実体に無い列）を出す。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.mark.md) | ライブラリ本体の計画書 |
