# develop に入った作業 PR のスクリーンショットとストーリーの画像を削除する

## 概要

develop の `docs/pr/*/スクリーンショット/` と `docs/pr/*/ストーリー/` の画像を、削除の commit で取り除く（履歴は書き換えない）。

## 背景

[#475](https://github.com/shuhei1101/mdmark/issues/475) の要望。
作業 PR のスクリーンショットが squash マージで develop に入り、リポジトリが重くなっている。
[shuhei1101/ai-monitor#3373](https://github.com/shuhei1101/ai-monitor/pull/3373) でこれからのスクリーンショットは Git 管理外に置くと決まり、既に入った画像は削除の commit を入れるとユーザーが判断した（[確認ログ](https://github.com/shuhei1101/ai-monitor/pull/3373#discussion_r4536950116)）。
本文の `tmp/screenshots/` の画像の削除と `tmp/` の Git 管理外の確認は、[#472](https://github.com/shuhei1101/mdmark/pull/472) で解消済み。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
