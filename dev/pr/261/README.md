# VS Code 拡張機能の ID を ShuheiNishikawa.mdmark-vscode・表示名を mdmark for VS Code に固定する

## 概要

VS Code 拡張機能の `name` を `mdmark-vscode`、`displayName` を `mdmark for VS Code` にし、拡張機能の ID を `ShuheiNishikawa.mdmark-vscode` に固定する。
拡張機能の ID・`name`・表示名を前提にしているテスト・設計書・文書を新しい値にそろえる。

## 背景

[Issue #157](https://github.com/shuhei1101/mdmark/issues/157) の要望。
`name` の `mdmark` と表示名の `mdmark` は、Visual Studio Marketplace 全体でほかの拡張機能が使っていて、アップロードが拒否される。
Marketplace には `ShuheiNishikawa.mdmark-vscode`（表示名 `mdmark for VS Code`）で手動で公開済みで、リポジトリの `vscode/package.json` だけが古い値のまま。
後続の [#84](https://github.com/shuhei1101/mdmark/issues/84)（Marketplace と Open VSX への公開の自動化）は、この ID を前提にする。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と影響する UC 一覧 |
| [VSCode拡張機能](./VSCode拡張機能.md) | VS Code 拡張機能の計画書 |
| [反映作業](./反映作業/index.yaml) | 反映作業の一覧 |

## タスク一覧

- [x] ~~初期構築~~（既存リポジトリのため対象外）
- [x] ~~リバースエンジニアリング~~（現状設計書が揃っている）
- [x] ~~方針決め~~（方針決めを依頼する Issue ではない）
- [x] ~~PoC 検証~~（未検証の技術機構に依存しない）
- [x] ~~複合ユースケース設計~~（影響なし: 業務の流れを変えない）
- [x] ~~デザインスタイル選定~~（画面の見た目を変えない）
- [x] ~~画面一覧・画面遷移~~（画面の追加・削除と画面遷移の変更を含まない）
- [x] ~~単一ユースケース設計~~（シナリオは拡張機能の ID の値を持たず、記述が変わらない）
- [x] ~~モック作成~~（画面の見た目を変えない）
- [x] インターフェース定義設計
- [x] ~~部品設計~~（部品の引数・状態を変えない）
- [x] ~~画面設計~~（画面の要素を変えない。コマンドの `category` の `mdmark` は変えない）
- [x] ~~モジュール構成設計~~（モジュール構成は `package.json` の `name`・`displayName` の値を持たない）
- [x] ドキュメント修正
- [x] ~~単体テスト作成~~（拡張機能の ID を使う単体テストが無い）
- [x] 実装
- [ ] 結合テスト作成
- [ ] E2E テスト作成
