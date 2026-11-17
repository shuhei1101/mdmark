# dist/index.js を配布ファイルの上限の内に収め、ビルドの結合テストを全 pass に保つ

## 概要

develop の `npm run build` が、`dist/index.js` が配布ファイル 1 つの上限を超えずに通り、`tests/integration/lib/build.test.ts` が全 pass になる。

## 背景

[ビルドの結合テスト 3 件が、dist/index.js が配布ファイルの上限（688128 バイト）を超えて fail する](https://github.com/shuhei1101/mdmark/issues/601) の要望。
[記法を含む既存の .md の拡張子を .mark.md へ移し、中身 1 つだけの guide/ のガイドの索引の置き場所を見直す](https://github.com/shuhei1101/mdmark/pull/595) の結合テストで、develop（[f79ed7d7](https://github.com/shuhei1101/mdmark/commit/f79ed7d7)）の `dist/index.js` が 701,585 バイトになり、上限（672KB = 688,128 バイト）を超えてビルドが終了コード 1 で終わることが見つかった。
上限は [map の図のタッチでのドラッグと、罫線のコードブロックの点検の警告を追加する](https://github.com/shuhei1101/mdmark/pull/508) で 672KB に上げた後、機能を追加する作業 PR のマージで `dist/index.js` が大きくなった。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
