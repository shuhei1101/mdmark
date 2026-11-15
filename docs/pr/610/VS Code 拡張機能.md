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

なし

### 結合

なし
