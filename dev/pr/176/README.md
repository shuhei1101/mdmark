# エイリアス（用語・文書・コマンド・URL など）を Markdown の用語集に加えて設定の aliases で YAML からも登録できるようにする

## 概要

使う側が、プロジェクトの任意の YAML（用語・コマンド・URL などの一覧）を `mdmark.config.yaml` の `aliases` で指し、Markdown の用語集の表に起こさずにエイリアスとして登録できるようにする。

## 背景

[Issue #125](https://github.com/shuhei1101/mdmark/issues/125) の要望。
今の mdmark は、索引の YAML（`terms[]`・`docs[]` の決まったスキーマ）と Markdown の用語集の表（`<!-- glossary -->`）からしか用語を登録できない（[src/knowledge/dictionary.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/knowledge/dictionary.ts)）。
各プロジェクトの YAML を使うには、索引のスキーマに書き換えるか表に起こす必要があり、コマンド・URL の種類も無い。
エイリアスの共通のスキーマは alias-inject が SSOT として持つ「エイリアスの元の行」（[alias-inject v0.2.0 の `schemas/aliases.schema.yaml`](https://github.com/shuhei1101/alias-inject/blob/v0.2.0/schemas/aliases.schema.yaml)、[alias-inject#20](https://github.com/shuhei1101/alias-inject/issues/20)）で、mdmark はタグを指定してこれを取り込む（D-120）。
mdmark は文書の中身を YAML から描かない（D-85）が、エイリアスの登録だけは例外にする（D-119）。
後続は、mdmark-style が設定の `aliases` を読む [#116](https://github.com/shuhei1101/mdmark/issues/116) と、dev-docs が読み込んだエイリアスを mdmark へ渡す [dev-docs#11](https://github.com/shuhei1101/dev-docs/issues/11)。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と影響する UC 一覧 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |

## タスク一覧

- [x] ~~初期構築~~（既存リポジトリのため対象外）
- [x] ~~リバースエンジニアリング~~（現状設計書が揃っている）
- [x] ~~方針決め~~（方針決めを依頼する Issue ではない）
- [x] PoC 検証
- [x] ~~複合ユースケース設計~~（影響なし: 業務の流れは変わらない）
- [x] ~~デザインスタイル選定~~（デザイン方針があり、見た目の方向を変えない）
- [x] ~~画面一覧・画面遷移~~（画面の追加・削除と画面遷移の変更を含まない）
- [x] 単一ユースケース設計
- [x] モック作成
- [x] インターフェース定義設計
- [x] 部品設計
- [ ] 画面設計
- [ ] モジュール構成設計
- [ ] ドキュメント修正（docs/リファレンス/設定.md・docs/リファレンス/API.md・docs/リファレンス/CLI.md・docs/リファレンス/用語集.md・docs/使い方/書く/索引と用語集を書く.md・docs/使い方/書き出す/点検する.md・docs/はじめに/コアコンセプト/索引と被参照.md）
- [ ] 単体テスト作成
- [ ] 実装
- [ ] 結合テスト作成
- [ ] E2E テスト作成
