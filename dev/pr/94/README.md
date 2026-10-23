# E2E『ClaudeCodeにプラグインを入れる』と『文書をHTML文字列にする』のケースを実際の出力に合わせて直す

## 概要

Sprint v0.7.0 の E2E で、実際の出力と合わずに落ちた 2 つのケースの判定を、Claude Code と `render` の実際の出力に合わせて直す。

## 背景

[Issue #93](https://github.com/shuhei1101/mdmark/issues/93) の束。
release/v0.7.0 の E2E（[E2E 実行 Issue #56](https://github.com/shuhei1101/mdmark/issues/56)・[release PR #85](https://github.com/shuhei1101/mdmark/pull/85)）で、次の 2 件が落ちた。
どちらも tester がテスト不備と切り分け、製品の挙動は仕様どおり。

- [#89](https://github.com/shuhei1101/mdmark/issues/89): 『ClaudeCodeにプラグインを入れる』の `test_normal` が、Claude Code 2.1.309 の `claude plugin list` が出さない `Read from:` の行から導入先を取ろうとして落ちる
- [#90](https://github.com/shuhei1101/mdmark/issues/90): 『文書をHTML文字列にする』の `test_normal` が、[#69](https://github.com/shuhei1101/mdmark/pull/69) で `data-source-line` を持つようになった段落を、属性の無い開始タグ `<p>` の文字列で探して落ちる

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と影響する UC 一覧 |
| [Claude Code プラグイン](./ClaudeCodeプラグイン.md) | Claude Code プラグインの計画書（#89） |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書（#90） |

## タスク一覧

- [x] ~~初期構築~~（既存リポジトリのため対象外）
- [x] ~~リバースエンジニアリング~~（現状の設計書が揃っている）
- [x] ~~方針決め~~（方針決めを依頼する Issue ではない）
- [x] ~~PoC 検証~~（未検証の技術機構に依存しない。`claude plugin list --json` の `installPath` は tester が手で確かめ済み）
- [x] ~~複合ユースケース設計~~（影響なし: E2E の 2 ケースの判定の修正に閉じる）
- [x] ~~デザインスタイル選定~~（見た目を変えない）
- [x] ~~画面一覧・画面遷移~~（画面の追加・削除と画面遷移の変更を含まない）
- [ ] 単一ユースケース設計
- [x] ~~モック作成~~（画面を変えない）
- [x] ~~インターフェース定義設計~~（入出力を変えない）
- [x] ~~部品設計~~（部品を変えない）
- [x] ~~画面設計~~（画面の要素を変えない）
- [x] ~~モジュール構成設計~~（実装を変えない）
- [ ] ドキュメント修正（設計書/テスト/テスト実行方法.yaml）
- [x] ~~単体テスト作成~~（実装を変えない）
- [x] ~~実装~~（製品の挙動は仕様どおりで、テストコードだけを直す）
- [x] ~~結合テスト作成~~（インターフェースを変えない）
- [ ] E2E テスト作成
