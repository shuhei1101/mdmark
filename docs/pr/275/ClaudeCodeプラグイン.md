# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/ClaudeCodeから点検と書き出しを呼ぶ.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/ClaudeCode%E3%81%8B%E3%82%89%E7%82%B9%E6%A4%9C%E3%81%A8%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%97%E3%82%92%E5%91%BC%E3%81%B6.yaml) | Claude Code が `check`・`export_html`・`build_site` を呼ぶシナリオ | `check` が図の点検のずれも返すことに追従（#187） |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/点検する.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E7%82%B9%E6%A4%9C%E3%81%99%E3%82%8B.ts.yaml) | MCP の `check` の入出力 | 返すずれに図の点検を追加（#187） |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/MCPサーバー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC.ts.yaml) | MCP サーバーのツールの処理 | `check` の説明を更新（#187） |
| 実装 | [src/plugin/tools.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/tools.ts) | MCP のツールの定義と説明 | `check` の説明の点検するものの並びに図の点検を追加（#187） |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| `check` の結果 | ライブラリ本体の `collectCheckIssues` が返す図の点検のずれを、今のずれと同じ構造で返す | ツールの引数は変えない |
| `check` の説明 | AI が読むツールの説明の点検するものの並びに、図の定義の点検（定義の誤り・ノードの重なり・はみ出し・線の横切り・ラベルの長さ）を追加する | - |
| 既存機能への影響 | 他のツール（`read_guide`・`find_docs`・`list_tags`・`update_index`・`export_html`・`build_site`）の入出力を変えない | 既存の結合テストを回帰として回す |

## テスト結果

ドキュメント修正の工程は公開ドキュメントだけを変えるため、規約『V字モデル』の対応表で関係する単体・結合テストは無く、回していない。
