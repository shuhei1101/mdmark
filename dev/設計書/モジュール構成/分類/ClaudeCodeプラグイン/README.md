# ClaudeCodeプラグイン

ClaudeCodeプラグイン の設計書

## 目次

| ページ | 概要 |
| --- | --- |
| [MCPサーバー](./MCPサーバー.yaml) | `mdmark serve` が 127.0.0.1 の Streamable HTTP で待ち受ける MCP の常駐サーバー。`export_html`・`build_site`・`check`・`list_templates`・`add_template`・`apply_template` を登録し、作業のフォルダを引数の `project_dir` で受け、引数を検査してから CLI と同じ処理を呼ぶ。`src/cli/main.ts` は読み込まない。 |
| [セットアップ](./セットアップ/) | セットアップ の設計書 |
