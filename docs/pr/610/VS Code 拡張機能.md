# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/scenario/](https://github.com/shuhei1101/mdmark/blob/413825ab/docs/scenario)・[docs/interface/](https://github.com/shuhei1101/mdmark/blob/413825ab/docs/interface)・[docs/module/](https://github.com/shuhei1101/mdmark/blob/413825ab/docs/module) のうち VS Code 拡張機能の文書 | 設計書 | ライブラリ本体と同じく、Mermaid の flow・タグと description の欠けがある |
| 管理用の YAML | [vscode/files.yaml](https://github.com/shuhei1101/mdmark/blob/413825ab/vscode/files.yaml) | コード・テストの行 | 設計書への `related` が無い |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 設計書 | ライブラリ本体の計画書の変更方針と同じく移行する | - |
| コード・テストの行 | `vscode/files.yaml` の行に `related`（`implements`・`tests`）を張る | - |

## テスト結果

### 単体

なし。
この PR は文書（設計書・ガイド・PR ドキュメント）と管理用の YAML だけを変え、コードを変えていないため、規約『V字モデル』の対応表で関係する単体テストは無い。

### 結合

なし。
理由は単体と同じ。

### 文書の点検

| 点検 | 結果 | ログ |
| --- | --- | --- |
| 全文書の mdmark の点検 | この PR が追加した記載の警告は 0 件。残る警告は見本・テストの入力の値・生成した README・スコープ外の `id:` のリンク | [文書の点検](テスト結果/20261116180236_f1ed3b1b_%E6%96%87%E6%9B%B8%E3%81%AE%E7%82%B9%E6%A4%9C.log) |
