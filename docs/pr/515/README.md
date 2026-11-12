# VS Code 拡張機能の「HTML に書き出す」で、設定の aliases のエイリアスのツールチップを出す

## 概要

VS Code 拡張機能で文書を書き出す人が、「HTML に書き出す」「ブラウザで開く」「PDF に印刷する」の HTML でも、`mdmark.config.yaml` の `aliases` のエイリアスに下線と種類ごとのツールチップを確認できるようになる。

## 背景

[Issue #379](https://github.com/shuhei1101/mdmark/issues/379) の要望。
[PR #378](https://github.com/shuhei1101/mdmark/pull/378)（[Issue #180](https://github.com/shuhei1101/mdmark/issues/180)）で、プレビューは設定の `aliases` からエイリアスを作り `mount` に指定するようになった。
書き出す HTML は PR #378 のスコープ外で、`vscode/src/export/html.ts` は `mount` にエイリアスを指定していない。
そのため、プレビューと書き出した HTML で下線とツールチップの有無がずれる。
CLI の `mdmark export` は `src/cli/aliases.ts` の `loadAliases` で作ったエイリアスを HTML に埋めている。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [VS Code 拡張機能](./VSCode拡張機能.md) | VS Code 拡張機能の計画書 |
