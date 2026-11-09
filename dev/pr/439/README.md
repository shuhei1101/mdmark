# src/cli/embed.ts の使用していない定数 HTTP_PATTERN と import の resolve を削除する

## 概要

`src/cli/embed.ts` の使用していない定数 `HTTP_PATTERN` と import の `resolve` を削除し、`npx biome check .` の警告を 0 件にする。

## 背景

[Issue #363](https://github.com/shuhei1101/mdmark/issues/363) の要望。develop で `npx biome check .` を実行すると、`src/cli/embed.ts` に `noUnusedVariables`（`HTTP_PATTERN`）の警告が出る。
`HTTP_PATTERN` は [#347](https://github.com/shuhei1101/mdmark/pull/347) で拡張をまとめる処理を `src/cli/embed.ts` の外へ移したときに参照が無くなり、定義だけが残った。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
