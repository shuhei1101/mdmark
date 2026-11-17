# 物理ファイルごとのモジュール構成を持たない src/・vscode/src/ の 6 ファイルに、要素を記載したモジュール構成を作る

## 概要

物理ファイルごとのモジュール構成を持たない `src/render/syntax/blocks.ts`・`src/render/syntax/tokens.ts`・`src/viewer/includes.ts`・`src/viewer/viewer.css`・`vscode/src/escape.ts`・`vscode/src/workspace.ts` に、要素を記載したモジュール構成を作る。

## 背景

[物理ファイルごとのモジュール構成を持たない src/・vscode/src/ の 6 ファイルに、要素を記載したモジュール構成を作る](https://github.com/shuhei1101/mdmark/issues/590) の要望。
[物理ファイルごとのモジュール構成を持たない src/・vscode/src/ の 4 ファイルに、要素を記載したモジュール構成を作る](https://github.com/shuhei1101/mdmark/pull/589) の現状調査で、同じ種類の残りとして 6 ファイルが見つかった。
6 ファイルの管理用の YAML の行は、フォルダ単位のモジュール構成を implements で指している。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | `src/` の 4 ファイルのモジュール構成の計画書 |
| [VS Code 拡張機能](./VS%20Code%20拡張機能.md) | `vscode/src/` の 2 ファイルのモジュール構成の計画書 |
