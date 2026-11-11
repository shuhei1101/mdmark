# 結合テストの Chromium をプロジェクトで共有し、開いたページを閉じ、並列の上限を設けてメモリの使用を減らす

## 概要

開発者が、結合テスト（`npm run test:integration`）をほかの作業と重なっても、所要時間を大きく延ばさずに全件を最後まで実行できるようになる。

## 背景

[Issue #373](https://github.com/shuhei1101/mdmark/issues/373) の要望。
PR [#352](https://github.com/shuhei1101/mdmark/pull/352) で Storybook の結合テストが OOM killer に止められ、PR [#355](https://github.com/shuhei1101/mdmark/pull/355) では `--maxWorkers=2` で 6 回に分けて実行した。
2026-11-08 には PR [#394](https://github.com/shuhei1101/mdmark/pull/394) の全件の実行が Chromium のレンダラーを 15 本（約 3.2GB）使用し、同じ端末の別のリポジトリの結合テストが止まった（[コメント](https://github.com/shuhei1101/mdmark/issues/373#issuecomment-6721711330)）。
暫定として、連絡ボードの `共通` に行「結合テストの全件は maxWorkers=4 で流す」がある。

`*.story.test.ts` はファイルごとの `beforeAll` で `createBrowserHolder` から Chromium を起動し、開いたページをファイルの終わりまで閉じない。
`vitest.config.ts` の `integration-storybook`・`integration-browser` に `maxWorkers` が無い。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の結合テストの準備の計画書 |
| [反映作業](./反映作業/index.yaml) | マージの後に連絡ボードの暫定の行を削除する作業 |
