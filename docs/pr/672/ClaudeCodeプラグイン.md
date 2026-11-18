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
| `.claude-plugin/` | `.claude-plugin/files.yaml` を新設し、`project-index.yaml` の `documents[]` に行を追加する | - |

## テスト結果

なし（コードを変えない）
