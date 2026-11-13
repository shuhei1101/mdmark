# 結合テスト test_normal_when_unbundled_icons が全件の実行でアイコンの要求を 0 件と記録して fail する原因を特定して修正する

## 概要

開発者が、ライブラリの結合テストの全件を流したときに `test_normal_when_unbundled_icons` の fail で流し直さずに済むようになる。

## 背景

[#502](https://github.com/shuhei1101/mdmark/issues/502) の要望。
[PR #485](https://github.com/shuhei1101/mdmark/pull/485) の修正後の全件の実行（commit e4879428、1056 件のうち 1 件 fail）で、`tests/integration/lib/mount.browser.test.ts` の `test_normal_when_unbundled_icons` が fail した。
アイコンの `svg` は 3 つ描かれていたが、`stubLucide` の CDP の `Fetch.requestPaused` が記録した要求は 0 件だった。同じ commit でこのテストだけを流すと pass する。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と影響する UC 一覧 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
