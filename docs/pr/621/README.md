# ほかのリポジトリが mdmark の develop の最新を参照できるようにする

## 概要

mdmark を参照するリポジトリが、タグを待たずに develop の最新の mdmark を使用できるようにし、固定したいときはタグ・commit を指定できるようにする。

## 背景

[Issue #620](https://github.com/shuhei1101/mdmark/issues/620) の要望。
mdmark の新規の機能を使用する作業 PR が、タグを打つ [#571](https://github.com/shuhei1101/mdmark/issues/571) を待って止まり、それを待つ別のリポジトリの作業 PR まで止まった（shuhei1101/dev-docs#212 → shuhei1101/project-index#70、shuhei1101/knowledge#396）。

今の develop は、`dist/`・`plugin/` の生成物をタグを打つときにだけ commit する（[#492](https://github.com/shuhei1101/mdmark/pull/492)）。
そのため `@develop`・`#develop` で参照しても、前回のタグの配布物が動く。
設定の `version` は `v{x}.{y}.{z}` だけを受け付け、`mdmark upgrade` が移行の手順を適用する基準に使用する。
develop で配布物を再作成する案は [#171](https://github.com/shuhei1101/mdmark/issues/171) で一度取り下げており、本件はユーザーの判断で改めて切り替える。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | 配布物・CLI・設定の Schema・移行の手順の計画書 |
| [Claude Code プラグイン](./Claude%20Code%20プラグイン.md) | develop で commit する `plugin/` の生成物とセットアップの計画書 |
