# 結合テスト test_normal_when_range_scripts を通しで実行しても範囲のスクリプトの読み込みを数えられるようにする

## 概要

`tests/integration/lib/mount.browser.test.ts` を 1 ファイル通しで実行しても、`test_normal_when_range_scripts` が範囲のスクリプトの変換のライブラリの読み込みを正しく数えて合格するようにする。

## 背景

[Issue #364](https://github.com/shuhei1101/mdmark/issues/364) の要望。
ファイルを通しで実行すると `countRequests("/fixtures/babel.mjs?normal")` が 0 件になって落ち、`-t test_normal_when_range_scripts` で単独に実行すると合格する。
Issue では、前のテストの読み込みでリソースのタイミングの記録が上限（既定 250 件）に達することを原因の見込みとしていた。切り分けの結果は [ライブラリ本体](./ライブラリ本体.md) の `## 原因の切り分け`。
このテストは [PR #303](https://github.com/shuhei1101/mdmark/pull/303) で追加した。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の結合テストの計画書 |
