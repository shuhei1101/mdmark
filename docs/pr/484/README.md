# VS Code 拡張機能のプレビューと書き出す HTML の mount に設定 tooltips と syntax.url を指定する

## 概要

文書を書く人が `mdmark.config.yaml` に `tooltips`・`syntax.url` を記載すると、VS Code 拡張機能のプレビューと書き出した HTML でも、ツールチップの出る位置と色分けのライブラリの読み込み先がその値になる。

## 背景

[Issue #380](https://github.com/shuhei1101/mdmark/issues/380) の要望。
[Issue #259](https://github.com/shuhei1101/mdmark/issues/259)（[PR #381](https://github.com/shuhei1101/mdmark/pull/381)）の受付で、同じ型の取りこぼしとして切り出した。
拡張機能は `vscode/src/config.ts` の `pickPreviewConfig` で `tooltips`・`syntax` を取り出していないため、プレビューと書き出し（HTML に書き出す・ブラウザで開く・PDF に印刷）の `mount` では、記載した値が効かない。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [VSCode拡張機能](./VSCode拡張機能.md) | VS Code 拡張機能の計画書 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
