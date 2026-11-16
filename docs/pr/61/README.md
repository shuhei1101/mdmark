# 索引の用語にやめた言い方（avoid）を書けるようにし、本文に出たら点検で知らせる

## 概要

文書を書く人が索引の用語にやめた言い方（`avoid`）を書き、文書の本文にやめた言い方が残っていることを `checkIndex`・`mdmark check` の点検で知れるようにする。

## 背景

[索引の用語にやめた言い方（avoid）を書き、本文に出たら点検で知らせる](https://github.com/shuhei1101/mdmark/issues/30) の要望。
[文書の索引・用語のツールチップ・被参照を表示する](https://github.com/shuhei1101/mdmark/pull/27)（起点 [文書の索引・用語のツールチップ・被参照を表示する](https://github.com/shuhei1101/mdmark/issues/5)）で、索引の用語（`terms`）と、索引と文書のずれを返す点検（`checkIndex`）を入れた。
用語のやめた言い方は、起点 Issue の点検の項目に無いため PR [文書の索引・用語のツールチップ・被参照を表示する](https://github.com/shuhei1101/mdmark/pull/27) の要件.md の `## スコープ外` に切り出した。
PR [文書の索引・用語のツールチップ・被参照を表示する](https://github.com/shuhei1101/mdmark/pull/27) はマージ済みで、索引の形（`src/knowledge/index-shape.ts`）・点検（`src/knowledge/check.ts`）・索引の JSON Schema（`schemas/mdmark.index.schema.json`）は develop にある。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と影響する UC 一覧 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |

## タスク一覧

- [x] ~~初期構築~~（既存リポジトリのため対象外）
- [x] ~~リバースエンジニアリング~~（現状設計書が揃っている）
- [x] ~~方針決め~~（方針決めを依頼する Issue ではない）
- [x] ~~PoC 検証~~（未検証の技術機構に依存しない。本文の語の一致は文書の別名の一致で使っている）
- [x] ~~複合ユースケース設計~~（影響なし: 業務の流れは変わらない）
- [x] ~~デザインスタイル選定~~（画面の見た目が変わらない）
- [x] ~~画面一覧・画面遷移~~（画面の見た目が変わらない）
- [x] 単一ユースケース設計
- [x] ~~モック作成~~（画面の見た目が変わらない）
- [x] インターフェース定義設計
- [x] ~~部品設計~~（部品の引数・状態が変わらない）
- [x] ~~画面設計~~（変更が画面に及ばない）
- [x] モジュール構成設計
- [x] ドキュメント修正（[索引](https://github.com/shuhei1101/mdmark/blob/2eea98f0856a88b9e789182b338f0c5a87743eea/docs/リファレンス/索引.md)・[API](https://github.com/shuhei1101/mdmark/blob/2eea98f0856a88b9e789182b338f0c5a87743eea/docs/リファレンス/API.md)・[CLI](https://github.com/shuhei1101/mdmark/blob/2eea98f0856a88b9e789182b338f0c5a87743eea/docs/リファレンス/CLI.md)・[用語集](https://github.com/shuhei1101/mdmark/blob/2eea98f0856a88b9e789182b338f0c5a87743eea/docs/リファレンス/用語集.md)・[索引と用語集を書く](https://github.com/shuhei1101/mdmark/blob/2eea98f0856a88b9e789182b338f0c5a87743eea/docs/使い方/書く/索引と用語集を書く.md)・[点検する](https://github.com/shuhei1101/mdmark/blob/2eea98f0856a88b9e789182b338f0c5a87743eea/docs/使い方/書き出す/点検する.md)・[索引と被参照](https://github.com/shuhei1101/mdmark/blob/2eea98f0856a88b9e789182b338f0c5a87743eea/docs/はじめに/コアコンセプト/索引と被参照.md)）
- [x] 単体テスト作成
- [x] 実装
- [x] 結合テスト作成
- [x] E2E テスト作成