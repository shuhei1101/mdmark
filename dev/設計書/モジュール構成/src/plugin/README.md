# plugin

plugin の設計書

## 目次

<!-- table: data -->

| ページ | 概要 |
| --- | --- |
| [arguments.ts](./arguments.ts.yaml) | ClaudeCodeプラグイン / MCPサーバー / arguments.ts |
| [guide.ts](./guide.ts.yaml) | ガイドの索引（名前・参照するとき・概要・本文のページ）の構造を検査する。プラグインのビルドが使用する。 |
| [http.ts](./http.ts.yaml) | ClaudeCodeプラグイン / MCPサーバー / http.ts |
| [mcp.ts](./mcp.ts.yaml) | ClaudeCodeプラグイン / MCPサーバー / mcp.ts |
| [port.ts](./port.ts.yaml) | `127.0.0.1` のポートが待ち受けているかの確認と、待ち受けるポートの読み取り（`mdmark serve`・SessionStart のフック・`setup.js` が使用する）。 |
| [pre-tool-use.ts](./pre-tool-use.ts.yaml) | プラグインの `hooks/hooks.json` が `node` で起動する処理。PreToolUse で作業のフォルダを MCP のツールの引数 `project_dir` に入れる。 |
| [session-start.ts](./session-start.ts.yaml) | プラグインの `hooks/hooks.json` の SessionStart が `node` で起動する処理。常駐サーバーが待ち受けていないときだけ、そのことを 1 行で指定する。 |
| [setup](./setup/) | setup の設計書 |
| [templates.ts](./templates.ts.yaml) | 端末の設定のフォルダの `templates/css/` に配置する CSS のテンプレートの索引を読み込み・検査し・記載し、テンプレートを一覧・登録・配置する。MCP の `list_templates`・`add_template`・`apply_template` の処理が呼ぶ。 |
| [tools.ts](./tools.ts.yaml) | ClaudeCodeプラグイン / MCPサーバー / tools.ts |

<!-- /table -->
