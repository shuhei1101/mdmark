# VS Code 拡張機能の結合テストで fail する mermaid の書き出しとプレビューの 2 件を修正する

## 概要

VS Code 拡張機能の結合テストで fail する mermaid の 2 件（相対パスの `mermaid.url` での HTML の書き出し・プレビューでの mermaid の図の描画）の原因を特定し、テストか実装の誤っている側を修正して、VS Code 1.141.0 と stable で pass させる。

## 背景

[Issue #642](https://github.com/shuhei1101/mdmark/issues/642) の不具合。
[PR #641](https://github.com/shuhei1101/mdmark/pull/641) の結合テストの実行で見つかり、origin/develop（[e2d0e7d8](https://github.com/shuhei1101/mdmark/commit/e2d0e7d8)）の同じテスト・ソースでも再現した。
1.141.0 の実行が fail で終わるため、stable の VS Code の実行に進まない。
[PR #684](https://github.com/shuhei1101/mdmark/pull/684) の結合テストのログ（`docs/pr/684/テスト結果/20261119100349_65875236_結合テスト_VSCode拡張機能.log`）でも、`test_normal_when_mermaid` が同じ `Error: mermaid の図を描かない` で fail している。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [VS Code 拡張機能](./VS%20Code%20拡張機能.md) | VS Code 拡張機能の計画書 |
