# mdmark の既存の文書を dev-docs.yaml に載せ、タグで引けるようにする

## 概要

エージェントが mdmark の設計書・公開ドキュメント・コードを、dev-docs の `search_docs` でタグ・概要文・関連から引けるようにする。

## 背景

[Issue #178](https://github.com/shuhei1101/mdmark/issues/178) の要望。
mdmark の直下に `dev-docs.yaml` が無く、既存の文書は dev-docs で配信されていない。
依存の [shuhei1101/dev-docs#4](https://github.com/shuhei1101/dev-docs/issues/4)（`/dev-docs:setup`）・[shuhei1101/dev-docs#32](https://github.com/shuhei1101/dev-docs/issues/32)（メタデータを列の対応だけにする）・[shuhei1101/dev-docs#34](https://github.com/shuhei1101/dev-docs/issues/34)（`files.yaml` の列の値と `implements`・`tests`）・[shuhei1101/alias-inject#37](https://github.com/shuhei1101/alias-inject/issues/37)（`alias_type` を行の属性にする）は閉じている。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理・文書の一覧と扱い・更新ドキュメント・スコープ外 |
| [反映作業](./反映作業/index.yaml) | 端末の設定へ配信元を登録する作業 |

## タスク一覧

- [x] ~~初期構築~~（既存リポジトリのため対象外）
- [x] ~~リバースエンジニアリング~~（現状の設計書が揃っている）
- [x] ~~方針決め~~（方針決めを依頼する Issue ではない）
- [x] ~~PoC 検証~~（dev-docs の配信は knowledge・alias-inject で使っており、未検証の技術機構に依存しない）
- [x] ~~複合ユースケース設計~~（mdmark の振る舞いを変えない）
- [x] ~~デザインスタイル選定~~（画面を持たない変更）
- [x] ~~画面一覧・画面遷移~~（画面の追加・削除と画面遷移の変更を含まない）
- [x] ~~単一ユースケース設計~~（mdmark の振る舞いを変えない）
- [x] ~~モック作成~~（画面を持たない変更）
- [x] ~~インターフェース定義設計~~（操作の入出力を変えない）
- [x] ~~部品設計~~（部品を変えない）
- [x] ~~画面設計~~（画面を変えない）
- [x] ~~モジュール構成設計~~（コードを変えない）
- [ ] ドキュメント修正（dev-docs.yaml・files.yaml・dev/テンプレート/files.schema.yaml・設計書/アーキテクチャ図）
- [x] ~~単体テスト作成~~（コードを変えない）
- [x] ~~実装~~（コードを変えない）
- [x] ~~結合テスト作成~~（コードを変えない）
- [x] ~~E2E テスト作成~~（mdmark の振る舞いを変えない）
