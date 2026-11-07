# alias-inject v0.3.0 のエイリアスの元の行のスキーマ（行の alias_type・列名の metadata）を取り込む

## 概要

文書を書く人が、設定の `aliases` に alias-inject v0.3.0 と同じ構造（行の `alias_type`・列名の文字列の `metadata`・`body_file`）でエイリアスの元の行を記載でき、v0.2.0 の構造の行を `mdmark upgrade` で v0.3.0 の構造へ書き換えられるようになる。

## 背景

[Issue #182](https://github.com/shuhei1101/mdmark/issues/182) の要望。
alias-inject は [shuhei1101/alias-inject#37](https://github.com/shuhei1101/alias-inject/issues/37)（作業 PR [shuhei1101/alias-inject#41](https://github.com/shuhei1101/alias-inject/pull/41)）でエイリアスの元の行のスキーマの構造を変更し、[v0.3.0](https://github.com/shuhei1101/alias-inject/tree/v0.3.0) のタグで出した。
旧い構造の行は alias-inject が参照しない。
mdmark は v0.2.0 のスキーマを `schemas/alias-inject/v0.2.0/aliases.schema.json` に取り込み、`mdmark check` の検証と `buildAliases` の metadata の適用に使用している（[Issue #125](https://github.com/shuhei1101/mdmark/issues/125)、v0.9.0 で出した）。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と影響する UC 一覧 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体（取り込む Schema・CLI の検証・`buildAliases`・移行の手順）の計画書 |

## タスク一覧

- [x] ~~初期構築~~（既存リポジトリのため対象外）
- [x] ~~リバースエンジニアリング~~（現状設計書が揃っている）
- [x] ~~方針決め~~（方針決めを依頼する Issue ではない）
- [x] ~~PoC 検証~~（未検証の技術機構に依存しない。Schema の検証は採用済みの ajv で行う）
- [x] ~~複合ユースケース設計~~（影響なし: 設定の `aliases` を扱う複合ユースケースがない）
- [x] ~~デザインスタイル選定~~（デザイン方針があり、見た目の方向を変えない）
- [x] ~~画面一覧・画面遷移~~（画面の追加・削除と画面遷移の変更を含まない）
- [x] 単一ユースケース設計
- [x] ~~モック作成~~（画面の見た目を変えない）
- [ ] インターフェース定義設計
- [x] ~~部品設計~~（部品を変更しない）
- [x] ~~画面設計~~（画面の要素を変更しない）
- [ ] モジュール構成設計
- [ ] ドキュメント修正（要件.md の `## 更新ドキュメント`）
- [ ] 単体テスト作成
- [ ] 実装
- [ ] 結合テスト作成
- [ ] E2E テスト作成
