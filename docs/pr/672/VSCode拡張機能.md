# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [vscode/files.yaml](https://github.com/shuhei1101/mdmark/blob/develop/vscode/files.yaml) | `vscode/` の管理用の YAML | `files[3]` の `icon.png` が指すファイルが無く、`search_docs` が管理用の YAML ごと検索の対象から除いている |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| ファイルが無い行 | `icon.png` の行を今のアイコンのパスに修正するか、アイコンが無ければ行を削除する | - |
| メタデータ | `/project-index:setup` で行のメタデータを今の付け方で見直す | - |

## テスト結果

なし（コードを変えない）
