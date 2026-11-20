# VS Code 拡張機能の結合テストで再び fail する mermaid の書き出しとプレビューの 2 件を修正する

## 概要

VS Code 拡張機能の結合テストで再び fail する mermaid の 2 件（相対パスの `mermaid.url` での HTML の書き出し・プレビューでの mermaid の図の描画）の原因を特定し、テストか実装の誤っている側を修正して pass させる。

## 背景

[Issue #773](https://github.com/shuhei1101/mdmark/issues/773) の不具合。
同じ 2 件は [Issue #642](https://github.com/shuhei1101/mdmark/issues/642) で扱い、[PR #688](https://github.com/shuhei1101/mdmark/pull/688) で修正して closed になったが、origin/develop（[133b1da5](https://github.com/shuhei1101/mdmark/commit/133b1da5)）で再び fail する。
[PR #772](https://github.com/shuhei1101/mdmark/pull/772) の結合テストの実行で見つかり、PR #772 は develop へマージ済み。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理と変更箇所の由来 |
| [VS Code 拡張機能](./VS%20Code%20拡張機能.mark.md) | VS Code 拡張機能の計画書 |
