# E2E の差分ビューの準備で実行するタイムラインのコマンド名を VS Code 1.141 の名前に修正する

## 概要

E2E の共通の準備 `openCommitDiff` が、VS Code 1.141.0 にあるコマンド名でタイムラインを開き、`test_normal_when_commit_diff` が pass するようになる。

## 背景

[Issue #234](https://github.com/shuhei1101/mdmark/issues/234) の修正。
[release PR #229](https://github.com/shuhei1101/mdmark/pull/229) の E2E（[E2E 実行 Issue #153](https://github.com/shuhei1101/mdmark/issues/153)）で、`差分ビューの変更をプレビューで見る.spec.ts` の `test_normal_when_commit_diff` が VS Code 1.141.0 で fail し、tester がテスト不備と切り分けた。
`openCommitDiff` はコマンドパレットで `Timeline: Focus on Timeline View` を探すが、VS Code 1.141.0 の名前は `Explorer: Focus on Timeline View` だけだった。
Issue が依存に置いた差分ビューの `Shift+Alt+D` の不具合（[Issue #233](https://github.com/shuhei1101/mdmark/issues/233)）は、[PR #238](https://github.com/shuhei1101/mdmark/pull/238) で release/v0.9.0 へ入っている。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と影響する UC 一覧 |
| [VSCode拡張機能](./VSCode拡張機能.md) | VS Code 拡張機能の計画書 |

## タスク一覧

- [x] ~~初期構築~~（既存リポジトリのため対象外）
- [x] ~~リバースエンジニアリング~~（現状の設計書が揃っている）
- [x] ~~方針決め~~（方針決めを依頼する Issue ではない）
- [x] ~~PoC 検証~~（未検証の技術機構に依存しない）
- [x] ~~複合ユースケース設計~~（影響なし: 複合ユースケースのシナリオを変えない）
- [x] ~~デザインスタイル選定~~（見た目を変えない）
- [x] ~~画面一覧・画面遷移~~（画面の追加・削除と画面遷移の変更を含まない）
- [x] ~~単一ユースケース設計~~（影響なし: シナリオはタイムラインから差分を開くとだけ記載しており、コマンド名を持たない）
- [x] ~~モック作成~~（画面を変えない）
- [x] ~~インターフェース定義設計~~（製品のコードを変えない）
- [x] ~~部品設計~~（部品を変えない）
- [x] ~~画面設計~~（製品のコードを変えない）
- [x] ~~モジュール構成設計~~（製品のコードを変えない）
- [x] ~~ドキュメント修正~~（更新ドキュメントなし）
- [x] ~~単体テスト作成~~（製品のコードを変えない）
- [x] ~~実装~~（製品のコードを変えない）
- [x] ~~結合テスト作成~~（製品のコードを変えない）
- [ ] E2E テスト作成（共通の準備 `openCommitDiff` のコマンド名の修正）
