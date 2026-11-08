# src/files.yaml に行が無い src/ のファイルの行を追加する

## 概要

`src/files.yaml` に行が無い `src/` のファイルの行を追加し、dev-docs が設計書からこれらのコードをたどれるようにする。

## 背景

束の親 [Issue #433](https://github.com/shuhei1101/mdmark/issues/433) の要望。
子の [#345](https://github.com/shuhei1101/mdmark/issues/345)（`parts/back-to-top.ts`・`parts/chart.ts`）と [#346](https://github.com/shuhei1101/mdmark/issues/346)（`src/parts/` の外の 13 ファイル）は、規約『ドキュメント管理』の files.yaml（フォルダごとの `files.yaml` が 1 ファイル 1 行で持つ）に反する箇所を挙げている。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
