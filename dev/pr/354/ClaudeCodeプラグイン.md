# Claude Code プラグイン

## 現状

<!-- table: data -->

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/MCPサーバーを起動・停止する.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC%E3%82%92%E8%B5%B7%E5%8B%95%E3%83%BB%E5%81%9C%E6%AD%A2%E3%81%99%E3%82%8B.ts.yaml) | `mdmark serve` の起動・停止 | 起動の仕方は利用者に任せている。状態・ログの置き場所を持たない |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/フック.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E3%83%95%E3%83%83%E3%82%AF.ts.yaml) | PreToolUse のフック | SessionStart のフックは無い |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/プラグインのビルド.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3%E3%81%AE%E3%83%93%E3%83%AB%E3%83%89.ts.yaml) | `plugin/` に配布物を書く | スキルを書かない |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/MCPサーバー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC.ts.yaml) | MCP サーバーと `instructions` | 起動の案内を持たない |
| ドキュメント | [dev/設計書/設定/ClaudeCodeプラグイン.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E8%A8%AD%E5%AE%9A/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3.yaml) | `MDMARK_PORT`・`.mcp.json` | `MDMARK_STATE_DIR`・tmux のセッション名が無い |
| ドキュメント | [dev/設計書/外部ライブラリ/ClaudeCode.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E5%A4%96%E9%83%A8%E3%83%A9%E3%82%A4%E3%83%96%E3%83%A9%E3%83%AA/ClaudeCode.yaml) | Claude Code のプラグイン・フック・MCP | プラグインのスキルを確かめた記録が無い |
| ドキュメント | [dev/設計書/アーキテクチャ図/アーキテクチャ図.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A2%E3%83%BC%E3%82%AD%E3%83%86%E3%82%AF%E3%83%81%E3%83%A3%E5%9B%B3/%E3%82%A2%E3%83%BC%E3%82%AD%E3%83%86%E3%82%AF%E3%83%81%E3%83%A3%E5%9B%B3.yaml) | Claude Code プラグインのサブシステム | スキルを持たない |
| 実装 | [plugin/hooks/hooks.json](https://github.com/shuhei1101/mdmark/blob/develop/plugin/hooks/hooks.json) | PreToolUse だけ | - |
| 実装 | [src/plugin/http.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/http.ts) | 待ち受け・ポートの読み取り | - |
| 実装 | [src/plugin/pre-tool-use.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/pre-tool-use.ts) | PreToolUse のフックの入口 | - |
| テスト | [tests/e2e/単一ユースケース/MCPサーバーを起動・停止する.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC%E3%82%92%E8%B5%B7%E5%8B%95%E3%83%BB%E5%81%9C%E6%AD%A2%E3%81%99%E3%82%8B.spec.ts) / [tests/e2e/複合ユースケース/MCPサーバーを起動してプラグインからつなぐ.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E8%A4%87%E5%90%88%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC%E3%82%92%E8%B5%B7%E5%8B%95%E3%81%97%E3%81%A6%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3%E3%81%8B%E3%82%89%E3%81%A4%E3%81%AA%E3%81%90.spec.ts) | 起動・停止とつなぐ流れの E2E | 子プロセスで起動している |

<!-- /table -->

## 変更方針

<!-- table: data -->

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| スキル | `plugin/skills/global-setup/SKILL.md`・`plugin/skills/setup/SKILL.md` を置き、ビルドがソースから `plugin/` へ写す | dev-docs の `global-setup` を元にする |
| `global-setup` | 端末の設定のパスを決める → 移行か雛形から作成 → `settings.json` の `env` に `MDMARK_CONFIG`（既定と違うときだけ） → 常駐サーバーの起動と `tools/list` の確認 → フックの確認 → 結果を示す | 端末の設定のキーは 1 つずつ今の値と既定を示して確認してから書く |
| `setup` | 文書のフォルダの `mdmark.config.yaml` を、無ければ雛形から、あればキーごとに確認しながら作る・修正する | 雛形は `mdmark init` と同じものを使う |
| 常駐サーバーの起動 | tmux の `has-session` で既にあるかを確かめ、無ければ `new-session -d` で起動し、ポートが待ち受けるまで待つ。ログは状態の置き場所の `serve.log` に書く | `未確定`（要件.md の起動の仕方・セッション名） |
| 起動の案内 | SessionStart のフックでポートを確かめ、起動の有無・セッション名・起動の仕方を伝える | `未確定`（要件.md の案内の置き場所） |
| 状態の置き場所 | `MDMARK_STATE_DIR`、無ければ `${XDG_STATE_HOME:-~/.local/state}/mdmark` | - |
| tmux のセッション名 | 端末の設定のキーで変えられ、既定値を持つ | キー名は設定の設計で決める |

<!-- /table -->

## テスト結果

なし
