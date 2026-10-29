# 見た目のテーマを選べるようにし、プレビューから設定を開けるようにする

## 概要

文書を書く人が、描いた文書の配色を mdmark に入れた複数のテーマから設定で選べるようにし、VS Code のプレビューから mdmark の設定を開けるようにする。

## 背景

[Issue #120](https://github.com/shuhei1101/mdmark/issues/120) の要望。
今の配色は [src/index.css](https://github.com/shuhei1101/mdmark/blob/develop/src/index.css) の `:root` の CSS 変数の明るい配色と、OS の設定・`mdmark-theme-light` / `mdmark-theme-dark` の class で切り替える暗い配色の 1 組だけで、テーマを選ぶ設定は無い。
VS Code 拡張機能の設定は `mdmark.preview.theme`（`auto` / `light` / `dark`）で明暗を固定できるだけで、配色のテーマは選べない（[vscode/package.json](https://github.com/shuhei1101/mdmark/blob/develop/vscode/package.json)）。
プレビューから設定を開く手段は無く、コマンドパレットにあるのは YAML の設定ファイルを開く `mdmark.openConfig` だけ。
計画の扱いの判断（[#120 のコメント](https://github.com/shuhei1101/mdmark/issues/120#issuecomment-6384960518)）で、テーマの値の組は配色の変数に限り、配置の変数（`--mdmark-content-width`・`--mdmark-table-max-height` など。[#119](https://github.com/shuhei1101/mdmark/issues/119)）は含めない前提を置いた。

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
- [x] ~~PoC 検証~~（未検証の技術機構に依存しない: CSS 変数の値の組の切り替えと、VS Code の設定画面を開くコマンドで足りる）
- [x] ~~複合ユースケース設計~~（影響なし: 既存の業務の流れの範囲内）
- [x] デザインスタイル選定
- [x] ~~画面一覧・画面遷移~~（画面の追加・削除と画面遷移の変更を含まない: 設定は VS Code の設定画面を開く）
- [x] 単一ユースケース設計
- [x] モック作成
- [ ] インターフェース定義設計
- [ ] 部品設計
- [ ] 画面設計
- [ ] モジュール構成設計
- [ ] ドキュメント修正
- [ ] 単体テスト作成
- [ ] 実装
- [ ] 結合テスト作成
- [ ] E2E テスト作成
