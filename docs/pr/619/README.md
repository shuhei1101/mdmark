# VS Code 拡張機能のビルドのスクリプト（vscode/scripts/）に、複雑さの lint を適用する

## 概要

複雑さの lint（4 規則）を、VS Code 拡張機能のビルドのスクリプト `vscode/scripts/` の TypeScript にも error で適用する。

## 背景

[VS Code 拡張機能のビルドのスクリプト（vscode/scripts/）に、複雑さの lint を適用する](https://github.com/shuhei1101/mdmark/issues/572) の要望。
[既存の TypeScript 全体に複雑さの lint を error で適用し、違反を修正する](https://github.com/shuhei1101/mdmark/pull/569)（起点 [#344](https://github.com/shuhei1101/mdmark/issues/344)）が複雑さの規則を `src/`・`scripts/`・`vscode/src/`・`plugin/` へ広げ、`vscode/scripts/` はスコープ外として切り出した。
knowledge の規約『設計原則』の complexity-01 は、複雑さを lint で検査すると定める。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と違反の件数 |
| [ライブラリ本体](./ライブラリ本体.md) | `tools/eslint/` の計画書 |
