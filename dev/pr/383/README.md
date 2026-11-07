# Git フック（lefthook）を除外し、lint・型検査・テストを Git フックで実行しない

## 概要

開発者が commit・push するとき、Git フックで lint・型検査・単体テストを実行しないようにする。

## 背景

[Issue #377](https://github.com/shuhei1101/mdmark/issues/377) の要望。
lefthook の pre-commit（Biome・Webview の ESLint・型検査）と pre-push（`npm run test:unit`）が、planner が lint とテストを実行してログを残し、reviewer がログを確認する手順と同じ検査を重ねて実行している。
2026-11-07 は pre-push の単体テストが端末の負荷でタイムアウトし、`git push --no-verify` で push した（[PR #374](https://github.com/shuhei1101/mdmark/pull/374)）。
ユーザーが手元のクローンのフックを削除しても、`npm ci` がフックを入れ直す（[Issue #377 のコメント](https://github.com/shuhei1101/mdmark/issues/377#issuecomment-6712018509)）。
lefthook は [PR #342](https://github.com/shuhei1101/mdmark/pull/342) で導入し、[PR #370](https://github.com/shuhei1101/mdmark/pull/370) でフックの導入を `prepare` から lefthook の package の postinstall に移した。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と影響する UC 一覧 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
| [反映作業](./反映作業/index.yaml) | release が master へ入った後に手元のクローンの Git フックを削除する作業 |

## タスク一覧

- [x] ~~初期構築~~（既存リポジトリのため対象外）
- [x] ~~リバースエンジニアリング~~（現状設計書が揃っている）
- [x] ~~方針決め~~（方針決めを依頼する Issue ではない）
- [x] ~~PoC 検証~~（未検証の技術機構に依存しない）
- [x] ~~複合ユースケース設計~~（影響なし: Git フックを前提にした複合ユースケースが無い）
- [x] ~~デザインスタイル選定~~（画面を変えない）
- [x] ~~画面一覧・画面遷移~~（画面の追加・削除と画面遷移の変更を含まない）
- [x] 単一ユースケース設計
- [x] ~~モック作成~~（画面を変えない）
- [x] ~~インターフェース定義設計~~（影響なし: 外部インターフェースを変えない）
- [x] ~~部品設計~~（影響なし: UI の部品を変えない）
- [x] ~~画面設計~~（影響なし: 画面を変えない）
- [x] モジュール構成設計
- [x] ドキュメント修正（設計書/外部ライブラリ/lefthook.yaml の削除・設計書/開発コマンド/開発コマンド.yaml）
- [x] ~~単体テスト作成~~（変える関数が無い）
- [x] 実装
- [x] ~~結合テスト作成~~（外部インターフェースを変えない）
- [ ] E2E テスト作成
