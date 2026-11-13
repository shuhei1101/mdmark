# VS Code 拡張機能の結合テスト test_normal_when_library_origin_added のテストの文書の libraries のマーカーを JSON の記載に合わせる

## 概要

VS Code 拡張機能の結合テスト `vscode/tests/integration/preview-rerender.test.ts` の `test_normal_when_library_origin_added` を、テストの文書の `libraries` のマーカーを JSON の記載に合わせて pass させる。

## 背景

[#496](https://github.com/shuhei1101/mdmark/issues/496) の要望。
テストの文書が `libraries` のマーカーを今の書き方（`<!-- my-chart: a -->`）で記載している。[#477](https://github.com/shuhei1101/mdmark/pull/477) の要件 No 7 で今の書き方は描かずに記載の警告を出すようになり、このテストは「別の配信元がモジュールの要求を受けない」で毎回 fail する。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [VS Code 拡張機能](./VSCode拡張機能.md) | VS Code 拡張機能の計画書 |
