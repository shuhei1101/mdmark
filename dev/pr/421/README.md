# 単体テストで先に作った 2 つの Promise を 1 つずつ待ち、全件実行での未処理の拒否を無くす

## 概要

単体テストを全件実行したとき、全てのテストが pass すれば終了コードが 0 になるようにする。

## 背景

[Issue #331](https://github.com/shuhei1101/mdmark/issues/331) の要望。`npm run test:unit`（全件）で、`tests/unit/src/cli/markdown-check.test.ts` の `test_read_yaml_key_when_missing` が未処理の Promise の拒否を出し、全てのテストが pass しても終了コードが 1 になることがある。[#328](https://github.com/shuhei1101/mdmark/pull/328) で入ったテストの書き方による。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の単体テストの計画書 |
