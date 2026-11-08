# ClaudeCodeプラグイン

Claude Code プラグインの MCP サーバー・フック・ガイドと、プラグインのビルド

## 目次

<!-- table: data -->

| ページ | 概要 |
| --- | --- |
| [MCPサーバー.ts](./MCPサーバー.ts.yaml) | MCP サーバーの入口・ツールの処理・ツールの引数の検査 |
| [ガイド.ts](./ガイド.ts.yaml) | ガイドの索引の検査 |
| [フック.ts](./フック.ts.yaml) | PreToolUse のフックで作業のフォルダを project_dir に入れる |
| [プラグインのビルド.ts](./プラグインのビルド.ts.yaml) | ガイドの索引を検査し、フックをまとめ、バージョン・ライセンスを plugin/ に書き込む |
| [セットアップ](./セットアップ/) | global-setup・setup のスキルが呼ぶ setup.js のサブコマンド |
| [ポート.ts](./ポート.ts.yaml) | 127.0.0.1 のポートが待ち受けているかの確認 |
| [SessionStartのフック.ts](./SessionStartのフック.ts.yaml) | SessionStart のフックで常駐サーバーが待ち受けていないことを伝える |
| [CSSのテンプレート.ts](./CSSのテンプレート.ts.yaml) | CSS のテンプレートの索引の読み取り・検査・書き込みと、一覧・登録・配置 |

<!-- /table -->
