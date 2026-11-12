# VS Code の結合テスト test_normal_when_range_scripts で CSP の違反が 0 件であることを確認する

## 概要

VS Code 拡張機能の結合テスト `test_normal_when_range_scripts` で、CSP の違反が 0 件であることを確認する。

## 背景

[Issue #392](https://github.com/shuhei1101/mdmark/issues/392) の要望。
インターフェース定義『プレビューを開く』の正常系（範囲のスクリプトと CSS）は期待値に「CSP の違反が 0 件」を持つが、`test_normal_when_range_scripts` はこれを確認していない。
[PR #382](https://github.com/shuhei1101/mdmark/pull/382) のレビューで指摘され、#382 のスコープ外にした。
#382 で Webview がテストのときだけ `html` 要素の `data-mdmark-csp-violations` に CSP の違反の件数を記載するようになった。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [VS Code 拡張機能](./VSCode拡張機能.md) | VS Code 拡張機能の計画書 |
