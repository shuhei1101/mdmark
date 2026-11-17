# テストコード（tests/・vscode/tests/）に複雑さの lint を適用し、違反を修正する

## 概要

テストコード（`tests/`・`vscode/tests/` の TypeScript）にも ESLint の複雑さの 4 規則を適用し、違反を挙動を変えずに修正する。

## 背景

[Issue #573](https://github.com/shuhei1101/mdmark/issues/573) の要望。
[PR #569](https://github.com/shuhei1101/mdmark/pull/569)（起点 [Issue #344](https://github.com/shuhei1101/mdmark/issues/344)）が複雑さの規則を `src/`・`scripts/`・`vscode/src/`・`plugin/` に、[PR #619](https://github.com/shuhei1101/mdmark/pull/619) が `vscode/scripts/` に適用したが、テストコードは範囲に含まれていない。
knowledge の規約『設計原則』の complexity-01（複雑さは lint で検査する）は、テストコードに適用するかを定めていない。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | ESLint の設定と `tests/` のテストコードの計画書 |
| [VS Code 拡張機能](./VSCode拡張機能.md) | `vscode/tests/` のテストコードの計画書 |
