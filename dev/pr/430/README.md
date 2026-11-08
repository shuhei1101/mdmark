# 単体テスト test_to_browserslist が全件実行で 30 秒の時間切れにならないようにする

## 概要

単体テストの全件実行で、`tests/unit/scripts/baseline.test.ts` の `test_to_browserslist` が実行の時間に左右されず pass するようにする。

## 背景

[Issue #334](https://github.com/shuhei1101/mdmark/issues/334) の報告。
`npm run test:unit`（全件）で `test_to_browserslist` が `Error: Test timed out in 30000ms.` で失敗することがあり、ファイル単体の実行では 19 件とも pass する。
[PR #307](https://github.com/shuhei1101/mdmark/pull/307) の全件実行で 2 回発生した（テストは 34667ms かかった）。
ファイルの最初のテストのため、`scripts/baseline.ts` の読み込み（eslint・eslint-plugin-compat・esbuild）の時間を負う。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の単体テストの計画書 |
