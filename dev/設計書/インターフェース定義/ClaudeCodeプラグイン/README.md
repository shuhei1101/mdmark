# ClaudeCodeプラグイン

Claude Code プラグインの MCP のツール・フックと、スキルが呼ぶスクリプト

## 目次

<!-- table: data -->

| ページ | 概要 |
| --- | --- |
| [点検する.ts](./点検する.ts.yaml) | mdmark check と同じ点検をし、ずれの一覧を返却する（check） |
| [文書をHTMLに書き出す.ts](./文書をHTMLに書き出す.ts.yaml) | mdmark export と同じ処理で 1 文書を 1 枚の HTML に書き出す（export_html） |
| [複数の文書を1枚のHTMLにまとめる.ts](./複数の文書を1枚のHTMLにまとめる.ts.yaml) | mdmark build と同じ処理で文書を 1 枚の HTML にまとめる（build_site） |
| [MCPサーバーを起動・停止する.ts](./MCPサーバーを起動・停止する.ts.yaml) | MCP の常駐サーバーを 127.0.0.1 の Streamable HTTP で起動し、instructions とツールを返却し、シグナルで停止する（mdmark serve） |
| [作業のフォルダを引数に入れる.ts](./作業のフォルダを引数に入れる.ts.yaml) | 作業のフォルダを使用するツールの引数に、PreToolUse のフックで project_dir を入れる |
| [常駐サーバーの状態を伝える.ts](./常駐サーバーの状態を伝える.ts.yaml) | SessionStart で常駐サーバーのポートを確認し、待ち受けていないときだけ global-setup での起動の仕方を 1 行で指定する |
| [端末の状態を調べる.ts](./端末の状態を調べる.ts.yaml) | 端末の設定のパスとバージョン・tmux のセッション名・待ち受けているか・ログの場所を返却する（setup.js status） |
| [設定のキーの一覧を返却する.ts](./設定のキーの一覧を返却する.ts.yaml) | 設定の Schema のキーごとに今の値・既定・説明を返却する（setup.js keys） |
| [端末の設定を記載する.ts](./端末の設定を記載する.ts.yaml) | 回答した値で端末の設定を作る・書き換え、既定のパスでなければ settings.json の env に MDMARK_CONFIG を記載する（setup.js write-settings） |
| [常駐サーバーを起動する.ts](./常駐サーバーを起動する.ts.yaml) | tmux のセッションで mdmark serve を起動し、待ち受けと tools/list を確認する（setup.js start-server） |
| [文書のフォルダの設定を記載する.ts](./文書のフォルダの設定を記載する.ts.yaml) | 回答した値で文書のフォルダの mdmark.config.yaml を作る・書き換える（setup.js write-config） |
| [CSSのテンプレートの一覧を返却する.ts](./CSSのテンプレートの一覧を返却する.ts.yaml) | 端末の設定のフォルダの CSS のテンプレートを、名前・説明・タグ・パスつきで返却する（list_templates） |
| [CSSのテンプレートを登録する.ts](./CSSのテンプレートを登録する.ts.yaml) | 作業のフォルダの CSS をテンプレートにコピーし、名前・説明・タグを索引に記載する（add_template） |
| [CSSのテンプレートを配置する.ts](./CSSのテンプレートを配置する.ts.yaml) | テンプレートの CSS を配置先へコピーし、theme に記載する値を返却する（apply_template） |

<!-- /table -->
