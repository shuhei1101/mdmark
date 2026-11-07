# VS Code 拡張機能の書き出した HTML で、相対パスの libraries と html-scripts.url を Chromium 系のブラウザでも読めるようにする

## 概要

文書を書く人が、VS Code 拡張機能で書き出した HTML を Chrome・Edge で開いても、相対パスで書いた `libraries` の外部ライブラリのマーカーと、相対パスの `html-scripts.url` を使う範囲のスクリプトが描かれるようになる。

## 背景

[Issue #348](https://github.com/shuhei1101/mdmark/issues/348) の不具合。
「HTML に書き出す」（`vscode/src/export/export.ts` の `readExportConfig`）は、相対パスの `libraries` と `html-scripts.url` を `file:` の URL にして HTML に入れる。
file:// で開いたページの origin は `null` になり、Chromium 系のブラウザは `file:` のモジュールの動的 `import()` を CORS で止めるため、そのマーカーと範囲に知らせの枠が出る。「ブラウザで開く」「PDF に印刷する」も同じ HTML を開く。

[PR #347](https://github.com/shuhei1101/mdmark/pull/347) で `extensions` は esbuild-wasm でまとめて `data:` の URL で HTML に埋める構造に修正した。`libraries`・`html-scripts.url` は PR #347 の前からある挙動のため、この Issue に切り出した。
[#190](https://github.com/shuhei1101/mdmark/issues/190)（mermaid の描画）は、この PR の埋め方の後に進める。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と影響する UC 一覧 |
| [VS Code 拡張機能](./VSCode拡張機能.md) | VS Code 拡張機能の計画書 |

## タスク一覧

- [x] ~~初期構築~~（既存リポジトリのため対象外）
- [x] ~~リバースエンジニアリング~~（現状設計書が揃っている）
- [x] ~~方針決め~~（方針決めを依頼する Issue ではない）
- [x] ~~PoC 検証~~（esbuild-wasm でまとめたモジュールを `data:` の URL で読む経路は [#349](https://github.com/shuhei1101/mdmark/pull/349) と PR #347 で確認済み）
- [x] ~~複合ユースケース設計~~（影響なし: 既存フローの範囲内）
- [x] ~~デザインスタイル選定~~（利用者に見える画面の見た目を変えない）
- [x] ~~画面一覧・画面遷移~~（画面の追加・削除と画面遷移の変更を含まない）
- [x] 単一ユースケース設計
- [x] ~~モック作成~~（利用者に見える画面の見た目を変えない）
- [x] インターフェース定義設計
- [x] ~~部品設計~~（部品を変えない）
- [x] ~~画面設計~~（UI 項目と操作を変えない）
- [ ] モジュール構成設計
- [ ] ドキュメント修正（要件.md の `## 更新ドキュメント`）
- [ ] 単体テスト作成
- [ ] 実装
- [ ] 結合テスト作成
- [ ] E2E テスト作成
