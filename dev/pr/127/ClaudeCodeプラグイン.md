# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/索引から文書を探す.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E7%B4%A2%E5%BC%95%E3%81%8B%E3%82%89%E6%96%87%E6%9B%B8%E3%82%92%E6%8E%A2%E3%81%99.yaml) | `find_docs` で文書を引くシナリオ | 更新対象 |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/索引を書き換える.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E7%B4%A2%E5%BC%95%E3%82%92%E6%9B%B8%E3%81%8D%E6%8F%9B%E3%81%88%E3%82%8B.yaml) | `update_index` で文書か用語かタグを書き換えるシナリオ | 更新対象 |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/ClaudeCodeから点検と書き出しを呼ぶ.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/ClaudeCode%E3%81%8B%E3%82%89%E7%82%B9%E6%A4%9C%E3%81%A8%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%97%E3%82%92%E5%91%BC%E3%81%B6.yaml) | `check`・`export_html`・`build_site` のシナリオ | 直し忘れの検査に比べる基準を渡すときに更新対象 |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/文書を探す.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E6%96%87%E6%9B%B8%E3%82%92%E6%8E%A2%E3%81%99.ts.yaml) | `find_docs` の `related_to` は、その文書を参照している文書とその文書が参照している文書を返す。`full` の `related` は `id` の並び | 更新対象 |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/索引を書き換える.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E7%B4%A2%E5%BC%95%E3%82%92%E6%9B%B8%E3%81%8D%E6%8F%9B%E3%81%88%E3%82%8B.ts.yaml) | `update_index` の `kind` は `doc`・`term`・`tag` | 更新対象 |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/点検する.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E7%82%B9%E6%A4%9C%E3%81%99%E3%82%8B.ts.yaml) | MCP の `check` の引数とずれの一覧 | 直し忘れの検査に比べる基準を渡すときに更新対象 |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/MCPサーバー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC.ts.yaml) | `TOOLS`・`runFindDocs`・`runUpdateIndex`・`runCheckTool` | 更新対象 |
| 実装 | [src/plugin/tools.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/tools.ts) | MCP のツールの定義と処理 | 更新対象 |
| 実装 | [src/plugin/results.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/results.ts) | `find_docs` の各行の項目。`related` は `id` の並び | 更新対象 |
| テスト | [tests/integration/ClaudeCodeプラグイン/find-docs.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/integration/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/find-docs.test.ts) | `find_docs` の結合テスト | 更新対象 |
| テスト | [tests/integration/ClaudeCodeプラグイン/update-index.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/integration/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/update-index.test.ts) | `update_index` の結合テスト | 更新対象 |
| テスト | [tests/e2e/単一ユースケース/索引から文書を探す.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E7%B4%A2%E5%BC%95%E3%81%8B%E3%82%89%E6%96%87%E6%9B%B8%E3%82%92%E6%8E%A2%E3%81%99.spec.ts) | 文書を探す E2E | 更新対象 |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| find_docs の related_to | 引いた各文書に、関係の種類・向き（相手から自分か、自分から相手か）・`when` を返す。本文のリンクと別名だけで当たった文書は、関係の種類を持たない参照として返す | 項目の名前と逆向きの関係の名前はインターフェース定義設計で決める |
| find_docs の related の項目 | `full` と `include` の `related` は、関連のオブジェクト（`to`・`type`・`when`・`paths`）の並びを返す | 文字列の要素を残す場合の返し方はインターフェース定義設計で決める |
| update_index | `kind: doc` の `related` をオブジェクトの並びで受け、書く前の索引のスキーマの検査で `to`・`type`・`when` の欠けと知らない `type` を拒む | 検査は今の `normalizeIndex` を使う。欠けと知らない `type` はインターフェース定義『索引を書き換える』の異常系で確かめる |
| check | 直し忘れの検査に比べる基準を任意の引数で受け、`mdmark check` と同じずれを返す | - |

## テスト結果

なし
