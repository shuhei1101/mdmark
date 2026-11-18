# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [plugin/files.yaml](https://github.com/shuhei1101/mdmark/blob/develop/plugin/files.yaml) | `plugin/` の管理用の YAML | メタデータの見直し |
| ドキュメント | [.claude-plugin/marketplace.json](https://github.com/shuhei1101/mdmark/blob/develop/.claude-plugin/marketplace.json) | マーケットプレイスの定義 | 管理用の YAML が無い |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| `plugin/files.yaml` | `/project-index:setup` で行のメタデータを今の付け方で見直す | ビルドした `*.js` は今の `exclude` のまま |
| `.claude-plugin/` | 直下の `files.yaml` に `marketplace.json` の行を記載する | - |

## テスト結果

コードを変えないため、単体・結合テストは対象が無い。索引の同期は [ライブラリ本体](./ライブラリ本体.md) の `## テスト結果` に記載する。
