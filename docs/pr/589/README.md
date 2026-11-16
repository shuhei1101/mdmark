# 物理ファイルごとのモジュール構成を持たない src/・vscode/src/ の 4 ファイルに、要素を記載したモジュール構成を作る

## 概要

物理ファイルごとのモジュール構成を持たない `src/map/structure.ts`・`src/parts/embedded-html.ts`・`src/parts/icon-node.ts`・`vscode/src/webview/vite-env.d.ts` に、要素を記載したモジュール構成を作る。

## 背景

[物理ファイルごとのモジュール構成を持たない src/・vscode/src/ の 4 ファイルに、要素を記載したモジュール構成を作る](https://github.com/shuhei1101/mdmark/issues/537) の要望。[モジュール構成のフォルダ構成（directory）に、どのツリーにも載っていない src/・vscode/src/ のファイルの行を追加する](https://github.com/shuhei1101/mdmark/pull/536) の現状調査で、4 ファイルを `container` に記載したモジュール構成が `docs/module/` に無いと分かった。
`src/map/structure.ts` の `collectMapStructure` は、`src/map/check.ts` のモジュール構成（MOD-472-135）に `container: src/map/check.ts` で記載されている。
4 ファイルをフォルダ構成（`directory`）のツリーへ追加する作業は [モジュール構成のフォルダ構成（directory）に、どのツリーにも載っていない src/・vscode/src/ のファイルの行を追加する](https://github.com/shuhei1101/mdmark/issues/495) で済んでいる。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | `src/` の 3 ファイルのモジュール構成の計画書 |
| [VS Code 拡張機能](./VS%20Code%20拡張機能.md) | `vscode/src/webview/vite-env.d.ts` のモジュール構成の計画書 |
