# map のストーリーの結合テスト 7 ファイルの Box・overlaps を、tests/integration/story.ts の共用のものに統一する

## 概要

map のストーリーの結合テスト 7 ファイルが、`tests/integration/story.ts` の共用の `Box`・`overlaps` を import して使う。

## 背景

[map のストーリーの結合テスト 7 ファイルが持つ Box・overlaps を、tests/integration/story.ts の共用のものへ寄せ替える](https://github.com/shuhei1101/mdmark/issues/667) の要望。
作業 PR [#665](https://github.com/shuhei1101/mdmark/pull/665) のレビューの指摘（[コメント](https://github.com/shuhei1101/mdmark/pull/665#discussion_r4607822870)）で `tests/integration/story.ts` に共用の `Box`・`overlaps` を置き、7 ファイルの統一をスコープ外として切り出した。
`map-flow.story.test.ts`・`map-sequence.story.test.ts` は既に共用のものを import している。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
