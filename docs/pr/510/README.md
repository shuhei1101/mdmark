# VS Code 拡張機能の結合テスト『プレビューを再描画する』の test_normal が時間の比較でときどき fail するのを修正する

## 概要

VS Code 拡張機能の結合テスト `vscode/tests/integration/preview-rerender.test.ts` の `test_normal` を、実行の速さによらず同じ結果になるように修正する。

## 背景

[#474](https://github.com/shuhei1101/mdmark/issues/474) の要望。
[#472](https://github.com/shuhei1101/mdmark/pull/472) の結合テストで、`render` を送信した時刻と最後の書き換えの時刻の比較（`sentAt - lastEdit >= 150`）が「最後の書き換えから -1254 ms」で fail した。同じ commit の次の実行は全 pass した。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [VS Code 拡張機能](./VSCode拡張機能.md) | VS Code 拡張機能の計画書 |
