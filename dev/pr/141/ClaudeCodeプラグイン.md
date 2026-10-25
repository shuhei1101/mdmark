# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/ClaudeCodeにプラグインを入れる.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/ClaudeCode%E3%81%AB%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3%E3%82%92%E5%85%A5%E3%82%8C%E3%82%8B.yaml) | プラグインを入れ、`installPath` の MCP サーバーを `.mcp.json` のコマンドで起動してツールの一覧を受け取る | 更新対象 |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/使い方集を読む.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E4%BD%BF%E3%81%84%E6%96%B9%E9%9B%86%E3%82%92%E8%AA%AD%E3%82%80.yaml) | `read_guide` のシナリオ | 追従 |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/索引から文書を探す.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E7%B4%A2%E5%BC%95%E3%81%8B%E3%82%89%E6%96%87%E6%9B%B8%E3%82%92%E6%8E%A2%E3%81%99.yaml) | `find_docs` のシナリオ | 追従 |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/索引を書き換える.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E7%B4%A2%E5%BC%95%E3%82%92%E6%9B%B8%E3%81%8D%E6%8F%9B%E3%81%88%E3%82%8B.yaml) | `update_index` のシナリオ | 追従 |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/ClaudeCodeから点検と書き出しを呼ぶ.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/ClaudeCode%E3%81%8B%E3%82%89%E7%82%B9%E6%A4%9C%E3%81%A8%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%97%E3%82%92%E5%91%BC%E3%81%B6.yaml) | `check`・`export_html`・`build_site` のシナリオ | 追従 |
| ドキュメント | [dev/設計書/シナリオ/複合ユースケース/ClaudeCodeで索引を書き換えて点検してから配る.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E8%A4%87%E5%90%88%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/ClaudeCode%E3%81%A7%E7%B4%A2%E5%BC%95%E3%82%92%E6%9B%B8%E3%81%8D%E6%8F%9B%E3%81%88%E3%81%A6%E7%82%B9%E6%A4%9C%E3%81%97%E3%81%A6%E3%81%8B%E3%82%89%E9%85%8D%E3%82%8B.yaml) | プラグインを入れてから索引を書き換え、点検してまとめる流れ | 更新対象 |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/使い方集を読む.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E4%BD%BF%E3%81%84%E6%96%B9%E9%9B%86%E3%82%92%E8%AA%AD%E3%82%80.ts.yaml) | `read_guide` の入出力 | 呼び出しを HTTP にするときに更新対象 |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/文書を探す.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E6%96%87%E6%9B%B8%E3%82%92%E6%8E%A2%E3%81%99.ts.yaml) | `find_docs` の入出力 | 作業のフォルダの引数で更新対象 |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/索引を書き換える.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E7%B4%A2%E5%BC%95%E3%82%92%E6%9B%B8%E3%81%8D%E6%8F%9B%E3%81%88%E3%82%8B.ts.yaml) | `update_index` の入出力 | 作業のフォルダの引数で更新対象 |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/点検する.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E7%82%B9%E6%A4%9C%E3%81%99%E3%82%8B.ts.yaml) | `check` の入出力 | 作業のフォルダの引数で更新対象 |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/文書をHTMLに書き出す.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E6%96%87%E6%9B%B8%E3%82%92HTML%E3%81%AB%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%99.ts.yaml) | `export_html` の入出力 | 作業のフォルダの引数で更新対象 |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/複数の文書を1枚のHTMLにまとめる.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E8%A4%87%E6%95%B0%E3%81%AE%E6%96%87%E6%9B%B8%E3%82%921%E6%9E%9A%E3%81%AEHTML%E3%81%AB%E3%81%BE%E3%81%A8%E3%82%81%E3%82%8B.ts.yaml) | `build_site` の入出力 | 作業のフォルダの引数で更新対象 |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/MCPサーバー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC.ts.yaml) | `createMcpServer`・`runMcpServer`（`CLAUDE_PROJECT_DIR` を読み `serveStdio` で動かす）・`TOOLS`・`ToolContext` | 更新対象 |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/フック.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E3%83%95%E3%83%83%E3%82%AF.ts.yaml) | SessionStart のフック | PreToolUse のフックを加える |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/プラグインのビルド.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3%E3%81%AE%E3%83%93%E3%83%AB%E3%83%89.ts.yaml) | MCP サーバーとフックを束ねて `plugin/` に書く | 束ねる入口が変わるときに更新対象 |
| 実装 | [src/plugin/mcp.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/mcp.ts) | 64 行目が `serveStdio(...)`。`CLAUDE_PROJECT_DIR` が無いと 1 で終わる | 更新対象 |
| 実装 | [src/plugin/tools.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/tools.ts) | `ToolContext` の `projectDir` を各ツールが使う | 作業のフォルダを引数から取る |
| 実装 | [plugin/.mcp.json](https://github.com/shuhei1101/mdmark/blob/develop/plugin/.mcp.json) | `command: node`・`args: [${CLAUDE_PLUGIN_ROOT}/server/mcp.js]` | 手で書くファイル。更新対象 |
| 実装 | [plugin/hooks/hooks.json](https://github.com/shuhei1101/mdmark/blob/develop/plugin/hooks/hooks.json) | SessionStart のフックだけ | PreToolUse のフックを加える |
| 実装 | [scripts/build-plugin.ts](https://github.com/shuhei1101/mdmark/blob/develop/scripts/build-plugin.ts) | `plugin/server/mcp.js` と `plugin/scripts/session-start.js` を束ねる | フックの入口が増える |
| テスト | [tests/unit/src/plugin/mcp.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/src/plugin/mcp.test.ts) | `runMcpServer` の単体テスト | 更新対象 |
| テスト | [tests/unit/scripts/build-plugin.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/scripts/build-plugin.test.ts) | `plugin/.mcp.json` を手で書くファイルとして確かめる | 更新対象 |
| テスト | [tests/integration/plugin.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/integration/plugin.ts) | 結合テストで MCP サーバーを子プロセスとして起動し、`StdioClientTransport` でつなぐ | 更新対象 |
| テスト | [tests/e2e/plugin.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/plugin.ts) | E2E で MCP サーバーを起動してつなぐ準備 | 更新対象 |
| テスト | [tests/e2e/単一ユースケース/ClaudeCodeにプラグインを入れる.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/ClaudeCode%E3%81%AB%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3%E3%82%92%E5%85%A5%E3%82%8C%E3%82%8B.spec.ts) | `.mcp.json` のコマンドで起動したサーバーがツールの一覧を返すかを確かめる | 更新対象 |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 待ち受け | `serveStdio` をやめ、`@modelcontextprotocol/server` 2.3.1 の HTTP の待ち受け（`createMcpHandler` など）を `node:http` のサーバーにつなぎ、`127.0.0.1` の `/mcp` で待ち受ける | 使う API と `node:http` へのつなぎ方は PoC 検証とモジュール構成設計で決める |
| ポート | 起動時に `MDMARK_PORT` を読み、無ければ 8782。ポートが数値でない・使われているときは待ち受けずに理由と直し方を出して 0 以外で終わる | 決める値の出所は knowledge の規約の既定のポートの台帳 |
| 接続先 | `plugin/.mcp.json` を `type: http`・`url: http://127.0.0.1:${MDMARK_PORT:-8782}/mcp` にする | `type` の無いエントリは stdio として読まれるので必ず添える |
| 作業のフォルダ | 作業のフォルダを使うツールに、作業のフォルダの絶対パスの引数を持たせる。プラグインの PreToolUse のフックが `mcp__plugin_mdmark_mdmark__*` の呼び出しに `CLAUDE_PROJECT_DIR` の値を入れる | 引数の名前はインターフェース定義設計で決める。引数が無い呼び出しの異常系もインターフェース定義で決める |
| セッションごとの状態 | ツールの処理は呼び出しごとに引数から前提を作り、プロセスの中にセッションごとの状態を持たない | 今の `ToolContext` から `projectDir` を外す |
| 使い方集と配布物 | `read_guide` の使い方集と、書き出しに埋める配布物は、サーバーを起動したときのルートから読む | ルートの決め方は起動の入口（要件の `未確定`）で決まる |
| 既存のツール | ツールの名前・引数（作業のフォルダを除く）・戻り値・`instructions` は変えない | - |

PoC 検証で確かめること:

| 検証構成 | 成功条件 |
| --- | --- |
| `@modelcontextprotocol/server` 2.3.1 の HTTP の待ち受けを `node:http` にのせた最小のサーバー | Claude Code の実機で、`.mcp.json` の `type: http`・`url` の `${MDMARK_PORT:-8782}` の展開でつながり、並行する 2 つのセッションが同じプロセスの `tools/list`・`tools/call` を受け取る |
| プラグインの PreToolUse のフックで MCP のツールの引数を書き換える | フックが返した引数（作業のフォルダ）がサーバーのツールに届き、エージェントが書いた引数は変わらない |

## テスト結果

未実行。
