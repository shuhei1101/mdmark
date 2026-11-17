# CHANGELOG.md の変更履歴へのリンクを docs/guide/変更履歴.mark.md へ修正する

## 概要

`CHANGELOG.md` から開いた利用者が、バージョンごとの変更履歴のページへ移動できるようにする。

## 背景

[Issue #585](https://github.com/shuhei1101/mdmark/issues/585) の要望。
`CHANGELOG.md` の 3 行目のリンク先 `./docs/はじめに/変更履歴.md` は develop に存在しない。
変更履歴の実体は [PR #595](https://github.com/shuhei1101/mdmark/pull/595) で改名された `docs/guide/変更履歴.mark.md` で、`src/cli/changelog.ts` の `CHANGELOG_FILE` も同じパスを持つ。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
