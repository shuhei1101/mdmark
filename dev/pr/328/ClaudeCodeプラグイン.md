# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/ClaudeCodeから点検と書き出しを呼ぶ.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/ClaudeCode%E3%81%8B%E3%82%89%E7%82%B9%E6%A4%9C%E3%81%A8%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%97%E3%82%92%E5%91%BC%E3%81%B6.yaml) | Claude Code が `check`・`export_html`・`build_site` を呼ぶシナリオ | 文字列・ファイルと YAML のキーを渡す点検を追加（#288） |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/点検する.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E7%82%B9%E6%A4%9C%E3%81%99%E3%82%8B.ts.yaml) | MCP の `check` の入出力 | 引数を追加（#288） |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/MCPサーバー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC.ts.yaml) | MCP サーバーのツールの処理と instructions | `check` の引数と説明・instructions の動線（#288） |
| 実装 | [src/plugin/tools.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/tools.ts) | MCP のツールの定義と説明 | `check` の引数は `base` だけ |
| 実装 | [src/plugin/mcp.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/mcp.ts) | MCP サーバーの instructions | 書いた後に `check` で点検する動線 |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| `check` の引数（#288） | ライブラリ本体の `mdmark check` と同じ引数（Markdown の文字列、またはファイルと YAML のキー）を追加し、同じずれの構造で返す | 入口の形は `要件.md` の未確定（推奨 A）で決める |
| `check` の説明と instructions（#288） | AI が読むツールの説明と instructions に、YAML のキーの中に書いた記法を書き込みのたびに点検する使い方を追加する | dev-docs の `write_docs`・MindStella の `add`・`update` から呼ぶ処理は呼ぶ側のリポジトリが持つ |
| 既存機能への影響 | 今の引数（`base` だけ）で呼んだ `check` の結果と、他のツールの入出力を変えない | 既存の結合テストを回帰として回す |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 単一ユースケース設計 | `208cbcd5..d3ccd5d7` | ClaudeCodeから点検と書き出しを呼ぶ |
| 単一ユースケース設計 | `21d52e3e..0264dbcf` | レビューの指摘の修正 |
| インターフェース定義設計 | `07d3d8a8..5989dde5` | 点検する |
| モジュール構成設計 | `302dcce2..e64ab315` | MCPサーバー |

## テスト結果

まだ実行していない。
