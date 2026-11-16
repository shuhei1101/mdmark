# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [plugin/files.yaml](https://github.com/shuhei1101/mdmark/blob/8e05422c/plugin/files.yaml) | プラグインの管理用の YAML | 行も除外も無いファイルが 4 件（まとめた配布物 3 件・`templates/mdmark.config.yaml` のコピー） |
| 設定 | [dev-docs.yaml](https://github.com/shuhei1101/mdmark/blob/8e05422c/dev-docs.yaml) の `id: plugin` の行 | プラグインのフォルダの配信の範囲 | `exclude` が `THIRD_PARTY_LICENSES.txt`・`pre-tool-use.js` をファイル名で除外している。更新対象 |
| ドキュメント | [docs/interface/IF-472-4.ts.yaml](https://github.com/shuhei1101/mdmark/blob/8e05422c/docs/interface/IF-472-4.ts.yaml) | MCP のインターフェース定義 | 配信元の説明書の場所を `dev-docs.yaml` の `instructions` と記載している。更新対象 |
| ドキュメント | [docs/guide/コアコンセプト-ClaudeCodeに使用方法を提供する仕組み.md](https://github.com/shuhei1101/mdmark/blob/8e05422c/docs/guide/%E3%82%B3%E3%82%A2%E3%82%B3%E3%83%B3%E3%82%BB%E3%83%97%E3%83%88-ClaudeCode%E3%81%AB%E4%BD%BF%E7%94%A8%E6%96%B9%E6%B3%95%E3%82%92%E6%8F%90%E4%BE%9B%E3%81%99%E3%82%8B%E4%BB%95%E7%B5%84%E3%81%BF.md) | Claude Code に使用方法を提供する仕組みのガイド | 配信元の説明書の場所を `dev-docs.yaml` の `instructions` と記載している。更新対象 |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| まとめた配布物の除外 | 配信元の設定の `id: plugin` の行の `exclude` を `*.js` にし、`pre-tool-use.js` の個別の除外を置き換える | `exclude` はファイル名だけに当たる。`scripts/build-plugin.ts` が `src/plugin/` から書き込むファイルで、原本は `src/files.yaml` が持つ |
| テンプレートのコピーの除外 | 配信元の設定の `id: plugin` の行の `exclude` に `mdmark.config.yaml` を追加する | `scripts/build-plugin.ts` が `templates/mdmark.config.yaml` から写すコピーで、原本は `templates/files.yaml` が持つ。`plugin/files.yaml` は変えない |
| 設計書・ガイドのパス | IF-472-4 とガイドの `dev-docs.yaml` の記述を `project-index.yaml` へ修正する | IF-472-4 は `write_docs` の `text_edits`、ガイドは Edit で修正する |

## テスト結果

なし（コードを変えない）。
