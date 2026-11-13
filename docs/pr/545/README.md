# ビルドの結合テスト test_normal で、marker-json.mjs を持つ移行の手順のフォルダを名前によらずコピーする

## 概要

結合テスト `tests/integration/lib/build.test.ts` の `test_normal` が、`marker-json.mjs` を持つ移行の手順のフォルダを `migrations/next` か `v{バージョン}` のどちらにあっても読み、全件の実行で pass するようにする。

## 背景

[Issue #542](https://github.com/shuhei1101/mdmark/issues/542) の事象。[c13cb8f3](https://github.com/shuhei1101/mdmark/commit/c13cb8f3) が `migrations/next` を `migrations/v0.11.0` へ移した後、`test_normal` がリポジトリの `migrations/next` をコピーしようとして `ENOENT` で fail する。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体のビルドの結合テストの計画書 |
