# ClaudeCodeプラグイン

Claude Code プラグインの MCP のツールと PreToolUse のフック

## 目次

<!-- table: data -->

| ページ | 概要 |
| --- | --- |
| [点検する.ts](./点検する.ts.yaml) | mdmark check と同じ点検をし、ずれの一覧を返す（check） |
| [文書をHTMLに書き出す.ts](./文書をHTMLに書き出す.ts.yaml) | mdmark export と同じ処理で 1 文書を 1 枚の HTML に書き出す（export_html） |
| [複数の文書を1枚のHTMLにまとめる.ts](./複数の文書を1枚のHTMLにまとめる.ts.yaml) | mdmark build と同じ処理で文書を 1 枚の HTML にまとめる（build_site） |
| [MCPサーバーを起動・停止する.ts](./MCPサーバーを起動・停止する.ts.yaml) | MCP の常駐サーバーを 127.0.0.1 の Streamable HTTP で起動し、instructions とツールを返し、シグナルで停止する（mdmark serve） |
| [作業のフォルダを引数に入れる.ts](./作業のフォルダを引数に入れる.ts.yaml) | 作業のフォルダを使うツールの引数に、PreToolUse のフックで project_dir を入れる |
| [CSSのテンプレートの一覧を返す.ts](./CSSのテンプレートの一覧を返す.ts.yaml) | 端末の設定のフォルダの CSS のテンプレートを、名前・説明・タグ・パスつきで返す（list_templates） |
| [CSSのテンプレートを登録する.ts](./CSSのテンプレートを登録する.ts.yaml) | 作業のフォルダの CSS をテンプレートにコピーし、名前・説明・タグを索引に記載する（add_template） |
| [CSSのテンプレートを配置する.ts](./CSSのテンプレートを配置する.ts.yaml) | テンプレートの CSS を配置先へコピーし、theme に記載する値を返す（apply_template） |

<!-- /table -->
