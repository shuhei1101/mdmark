# モジュール構成のフォルダ構成（directory）に、どのツリーにも載っていない src/・vscode/src/ のファイルの行を追加する

## 概要

モジュール構成（`docs/module/*.yaml`）のフォルダ構成（`directory`）のどのツリーにも載っていない `src/`・`vscode/src/` の 10 ファイルを、受け持つモジュール構成のツリーへ、行と受け持ちのコメントで追加する。

## 背景

[Issue #495](https://github.com/shuhei1101/mdmark/issues/495) の要望。
[PR #494](https://github.com/shuhei1101/mdmark/pull/494)（[Issue #437](https://github.com/shuhei1101/mdmark/issues/437)）の現状調査で、`src/cli/` 以外にもフォルダ構成に載っていないファイルが見つかった。
依存の [#455](https://github.com/shuhei1101/mdmark/issues/455) は取り下げで解消済み。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
| [VS Code 拡張機能](./VS%20Code%20拡張機能.md) | VS Code 拡張機能の計画書 |
| [Claude Code プラグイン](./Claude%20Code%20プラグイン.md) | Claude Code プラグインの計画書 |
