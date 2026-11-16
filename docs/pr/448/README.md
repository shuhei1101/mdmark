# 移行の手順の設計書の食い違い 2 件を修正する（点検する Schema を 4 つに統一する・『バージョンを上げる』の結合テストの準備の記述）

## 概要

移行の手順の設計書 3 件の記述を、develop のビルドの点検とテストに合わせる。

## 背景

束の親 [設計書の食い違い 2 件（移行の点検が no-steps.yaml の 2 つの Schema の行を誤りにする・『バージョンを上げる』の結合テストの準備の記述）](https://github.com/shuhei1101/mdmark/issues/447) の要望で、次の 2 件の子 Issue を 1 つの作業 PR で修正する。

| 子 | 食い違い |
| --- | --- |
| [移行の点検が no-steps.yaml の端末の設定・CSS のテンプレートの Schema の行を誤りにする](https://github.com/shuhei1101/mdmark/issues/368) | 移行の点検が `migrations/no-steps.yaml` の端末の設定・CSS のテンプレートの Schema の行を誤りにする。点検の `CHECKED_SCHEMAS` は [プラグインに global-setup・setup のスキルを置き、tmux でサーバーを起動して設定を利用者に確認しながら作る](https://github.com/shuhei1101/mdmark/pull/354)（[e86a6cb0](https://github.com/shuhei1101/mdmark/commit/e86a6cb0f)）で 4 つに直ったが、ER 図『移行の手順』とインターフェース定義『配布物をビルドする』は 2 つのまま |
| [インターフェース定義『バージョンを上げる』の test_normal_when_tag_vocabulary_dropped の準備が、migrations/next/ のスクリプトを配置すると記載している](https://github.com/shuhei1101/mdmark/issues/432) | [リポジトリの移行の手順を参照するテストを、スクリプトを持つ migrations/ のフォルダから参照するようにする](https://github.com/shuhei1101/mdmark/pull/407)（[9cea4fc7](https://github.com/shuhei1101/mdmark/commit/9cea4fc72)）で結合テスト `test_normal_when_tag_vocabulary_dropped` が `migrationsDirOf` でスクリプトを持つフォルダを探すようになったが、インターフェース定義『バージョンを上げる』の Mock は `migrations/next/` から配置すると記載している |

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と影響する UC 一覧 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
