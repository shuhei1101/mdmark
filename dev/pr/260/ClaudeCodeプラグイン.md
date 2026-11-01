# ClaudeCodeプラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/索引から文書を探す.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E7%B4%A2%E5%BC%95%E3%81%8B%E3%82%89%E6%96%87%E6%9B%B8%E3%82%92%E6%8E%A2%E3%81%99.yaml) | `find_docs` で索引から文書を引く | 削除 |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/タグの語彙を見る.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E3%82%BF%E3%82%B0%E3%81%AE%E8%AA%9E%E5%BD%99%E3%82%92%E8%A6%8B%E3%82%8B.yaml) | `list_tags` でタグの語彙を受け取る | 削除 |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/索引を書き換える.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E7%B4%A2%E5%BC%95%E3%82%92%E6%9B%B8%E3%81%8D%E6%8F%9B%E3%81%88%E3%82%8B.yaml) | `update_index` で索引の項目を書き換える | 削除 |
| ドキュメント | [dev/設計書/シナリオ/複合ユースケース/ClaudeCodeで索引を書き換えて点検してから配る.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E8%A4%87%E5%90%88%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/ClaudeCode%E3%81%A7%E7%B4%A2%E5%BC%95%E3%82%92%E6%9B%B8%E3%81%8D%E6%8F%9B%E3%81%88%E3%81%A6%E7%82%B9%E6%A4%9C%E3%81%97%E3%81%A6%E3%81%8B%E3%82%89%E9%85%8D%E3%82%8B.yaml) | 索引を引いて書き換え、点検してからまとめる | 削除 |
| ドキュメント | [dev/設計書/シナリオ/複合ユースケース/MCPサーバーを起動してプラグインからつなぐ.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E8%A4%87%E5%90%88%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC%E3%82%92%E8%B5%B7%E5%8B%95%E3%81%97%E3%81%A6%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3%E3%81%8B%E3%82%89%E3%81%A4%E3%81%AA%E3%81%90.yaml) | 常駐サーバーに 2 つのセッションからつなぎ、`find_docs` で確かめる | 確かめるツールを替える |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/文書を探す.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E6%96%87%E6%9B%B8%E3%82%92%E6%8E%A2%E3%81%99.ts.yaml) | `find_docs` | 削除 |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/タグの語彙を見る.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E3%82%BF%E3%82%B0%E3%81%AE%E8%AA%9E%E5%BD%99%E3%82%92%E8%A6%8B%E3%82%8B.ts.yaml) | `list_tags` | 削除 |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/索引を書き換える.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E7%B4%A2%E5%BC%95%E3%82%92%E6%9B%B8%E3%81%8D%E6%8F%9B%E3%81%88%E3%82%8B.ts.yaml) | `update_index` | 削除 |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/作業のフォルダを引数に入れる.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E4%BD%9C%E6%A5%AD%E3%81%AE%E3%83%95%E3%82%A9%E3%83%AB%E3%83%80%E3%82%92%E5%BC%95%E6%95%B0%E3%81%AB%E5%85%A5%E3%82%8C%E3%82%8B.ts.yaml) | PreToolUse のフックで `project_dir` を入れる | 対象のツールから 3 つを外す |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/MCPサーバーを起動・停止する.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC%E3%82%92%E8%B5%B7%E5%8B%95%E3%83%BB%E5%81%9C%E6%AD%A2%E3%81%99%E3%82%8B.ts.yaml) | `mdmark serve` の起動・停止と `tools/list` | `tools/list` が返すツールの数を 7 から 4 にする |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/MCPサーバー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC.ts.yaml) | MCP サーバーの入口・ツールの処理・引数の検査 | 3 つのツールの処理・結果の整形を外す |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/フック.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E3%83%95%E3%83%83%E3%82%AF.ts.yaml) | SessionStart・PreToolUse のフック | `PROJECT_DIR_TOOLS` から 3 つを外す |
| 実装 | [src/plugin/mcp.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/mcp.ts) | ツールの登録 | 3 つの登録を削除 |
| 実装 | [src/plugin/tools.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/tools.ts) | ツールの処理 | 3 つの処理を削除 |
| 実装 | [src/plugin/results.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/results.ts) | `find_docs`・`list_tags` の結果の整形 | 3 つのツールだけが使う部分を削除（残る使い道が無ければファイルごと削除） |
| 実装 | [src/plugin/pre-tool-use.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/pre-tool-use.ts)・[plugin/hooks/hooks.json](https://github.com/shuhei1101/mdmark/blob/develop/plugin/hooks/hooks.json) | PreToolUse のフックと matcher | 3 つの名前を削除 |
| テスト | `tests/integration/ClaudeCodeプラグイン/find-docs.test.ts`・`list-tags.test.ts`・`update-index.test.ts` | 3 つのツールの結合テスト | 削除 |
| テスト | `tests/e2e/単一ユースケース/索引から文書を探す.spec.ts`・`タグの語彙を見る.spec.ts`・`索引を書き換える.spec.ts` | 3 つの単一ユースケースの E2E | 削除 |
| テスト | `tests/e2e/複合ユースケース/ClaudeCodeで索引を書き換えて点検してから配る.spec.ts`・`MCPサーバーを起動してプラグインからつなぐ.spec.ts` | 複合ユースケースの E2E | シナリオに合わせて削除・変更 |
| テスト | `tests/unit/src/plugin/arguments.test.ts`・`mcp.test.ts`・`results.test.ts`・`tools.test.ts` | MCP サーバー・フックの単体テスト | 3 つのツールのケースを削除 |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| ツールの登録 | `src/plugin/mcp.ts` から 3 つの登録を削除し、`tools/list` が `read_guide`・`export_html`・`build_site`・`check` だけを返す | 外した名前の `tools/call` は MCP SDK の知らないツールのエラーのまま、独自の案内は足さない |
| ツールの処理 | `src/plugin/tools.ts` から 3 つの処理と、そこでしか使わない import を削除 | 残る 4 つの処理は変えない |
| 結果の整形 | `src/plugin/results.ts` の `find_docs`・`list_tags` の整形・カーソル・ヒントを削除 | 残る処理が使う関数が無ければファイルごと削除 |
| PreToolUse のフック | `PROJECT_DIR_TOOLS` と `hooks.json` の `matcher` を `check`・`export_html`・`build_site` だけにする | 2 つの並びは一致させたまま |
| 使い方集 | 元のページの修正の後に、プラグインのビルドで `plugin/guide/` を生成し直す | `dist/`・`plugin/scripts/` は release で入れる |
| 既存機能への影響 | 残る 4 つのツールの結合テストと E2E を回し、挙動が変わらないことを確かめる | - |

## テスト結果
