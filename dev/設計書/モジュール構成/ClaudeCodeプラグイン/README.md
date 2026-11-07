# ClaudeCodeプラグイン

Claude Code プラグインの MCP サーバー・フック・使い方集と、プラグインのビルド

## 目次

<!-- table: data -->

| ページ | 概要 |
| --- | --- |
| [MCPサーバー.ts](./MCPサーバー.ts.yaml) | MCP サーバーの入口・ツールの処理・ツールの引数の検査 |
| [使い方集.ts](./使い方集.ts.yaml) | 使い方集の索引の検査 |
| [フック.ts](./フック.ts.yaml) | PreToolUse のフックで作業のフォルダを project_dir に入れる |
| [プラグインのビルド.ts](./プラグインのビルド.ts.yaml) | 使い方集の索引を検査し、フックを束ね、バージョン・ライセンスを plugin/ に書く |
| [セットアップ](./セットアップ/) | global-setup・setup のスキルが呼ぶ setup.js のサブコマンド |
| [ポート.ts](./ポート.ts.yaml) | 127.0.0.1 のポートが待ち受けているかの確かめ |
| [SessionStartのフック.ts](./SessionStartのフック.ts.yaml) | SessionStart のフックで常駐サーバーが待ち受けていないことを伝える |
| [CSSのテンプレート.ts](./CSSのテンプレート.ts.yaml) | CSS のテンプレートの索引の読み取り・検査・書き込みと、一覧・登録・配置 |

<!-- /table -->
