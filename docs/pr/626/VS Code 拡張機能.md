# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [vscode/files.yaml](https://github.com/shuhei1101/mdmark/blob/8e05422c/vscode/files.yaml) | 拡張機能の管理用の YAML | `package-lock.json` に行も除外も無い |
| 設定 | [dev-docs.yaml](https://github.com/shuhei1101/mdmark/blob/8e05422c/dev-docs.yaml) の `id: vscode` の行 | 拡張機能のフォルダの配信の範囲 | `exclude` を持たない。更新対象 |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| lock ファイルの除外 | 配信元の設定の `id: vscode` の行に `exclude: [package-lock.json]` を追加する | `vscode/files.yaml` は変えない |

## テスト結果

なし（コードを変えない）。
