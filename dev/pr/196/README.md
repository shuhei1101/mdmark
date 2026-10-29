# VS Code の差分ビューで開いた Markdown の変更を、mdmark のプレビューに色分けで表示する

## 概要

文書を書く人が、VS Code の差分ビューで見ている Markdown の変更を、mdmark で描いたプレビューの上で、追加・変更した箇所が色分けされた状態で読めるようにする。

## 背景

[Issue #121](https://github.com/shuhei1101/mdmark/issues/121) の要望。
VS Code の拡張機能のプレビューは、開いている Markdown の 1 つの内容だけを描き、差分ビューの変更前と変更後を受け取る処理を持たない（[vscode/src/preview/manager.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/preview/manager.ts)）。
ライブラリ本体には [#7](https://github.com/shuhei1101/mdmark/issues/7) で入れた文書の差分表示があり、`mount` の `diffSource` に取り出し元を渡すと、読む人が「変更を見る」を押してから 2 つのリビジョンの差分を出す（[src/diff/panel.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/diff/panel.ts)）。
この差分表示が比べて色分けするのは Markdown のソースの行で、描いた結果ではない（[差分を表示する仕組み](https://github.com/shuhei1101/mdmark/blob/develop/docs/%E3%81%AF%E3%81%98%E3%82%81%E3%81%AB/%E3%82%B3%E3%82%A2%E3%82%B3%E3%83%B3%E3%82%BB%E3%83%97%E3%83%88/%E5%B7%AE%E5%88%86%E3%82%92%E8%A1%A8%E7%A4%BA%E3%81%99%E3%82%8B%E4%BB%95%E7%B5%84%E3%81%BF.md)）。
計画の扱いの判断（[#121 のコメント](https://github.com/shuhei1101/mdmark/issues/121#issuecomment-6385102457)）で、VS Code 拡張機能とライブラリ本体（`mount` の指定の追加）にまたがる作業とした。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と影響する UC 一覧 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
| [VSCode拡張機能](./VSCode拡張機能.md) | VS Code 拡張機能の計画書 |

## タスク一覧

- [x] ~~初期構築~~（既存リポジトリのため対象外）
- [x] ~~リバースエンジニアリング~~（現状設計書が揃っている）
- [x] ~~方針決め~~（方針決めを依頼する Issue ではない）
- [x] PoC 検証
- [x] ~~複合ユースケース設計~~（影響なし: 差分ビューから開く流れは単一ユースケースで閉じ、既存の複合ユースケースの流れは変わらない）
- [x] ~~デザインスタイル選定~~（デザイン方針があり、見た目の方向を変えない）
- [x] ~~画面一覧・画面遷移~~（画面の追加・削除と画面遷移の変更を含まない: 差分は既存のプレビューのパネルに描く）
- [ ] 単一ユースケース設計
- [ ] モック作成
- [ ] インターフェース定義設計
- [ ] 部品設計
- [ ] 画面設計
- [ ] モジュール構成設計
- [ ] ドキュメント修正
- [ ] 単体テスト作成
- [ ] 実装
- [ ] 結合テスト作成
- [ ] E2E テスト作成
