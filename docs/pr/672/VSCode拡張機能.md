# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [vscode/files.yaml](https://github.com/shuhei1101/mdmark/blob/develop/vscode/files.yaml) | `vscode/` の管理用の YAML | `files[3]` の `icon.png` が指すファイルが無く、`search_docs` が管理用の YAML ごと検索の対象から除いている |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| ファイルが無い行 | `icon.png` の行を削除する | `icon.png` はバイナリで project-index の管理用の YAML の対象にならない。原本の `icon.svg` の行は残す |
| メタデータ | `/project-index:setup` で行のメタデータを今の付け方で見直す | - |

## テスト結果

コードを変えないため、単体・結合テストは対象が無い。索引の同期は [ライブラリ本体](./ライブラリ本体.md) の `## テスト結果` に記載する。
