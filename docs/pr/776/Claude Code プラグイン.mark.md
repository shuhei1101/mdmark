# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [project-index.yaml](https://github.com/shuhei1101/mdmark/blob/4b89bc42/project-index.yaml) | 配信元の設定 | `mcp_server`・`agent_flow` の種類の行が無い。knowledge のスキーマの参照は `design-schemas/v8.4.0` |
| ドキュメント | [docs/module/MOD-472-2.yaml](https://github.com/shuhei1101/mdmark/blob/4b89bc42/docs/module/MOD-472-2.yaml) | モジュール構成『ClaudeCodeプラグイン / MCPサーバー』 | MCP サーバーの定義から参照される |
| ドキュメント | [docs/module/MOD-472-9.yaml](https://github.com/shuhei1101/mdmark/blob/4b89bc42/docs/module/MOD-472-9.yaml) | モジュール構成『ClaudeCodeプラグイン / セットアップ / 全体』 | スキルの本文を受け持つ。エージェントフローから参照される |
| ドキュメント | [docs/interface/IF-472-4.yaml](https://github.com/shuhei1101/mdmark/blob/4b89bc42/docs/interface/IF-472-4.yaml) | インターフェース定義『MCPサーバーを起動・停止する』 | 接続の仕方の根拠 |
| ドキュメント | [docs/interface/IF-472-9.yaml](https://github.com/shuhei1101/mdmark/blob/4b89bc42/docs/interface/IF-472-9.yaml) ほか | ツールごとのインターフェース定義（`export_html`・`build_site`・`export_markdown`・`list_templates`・`add_template`・`apply_template`） | `tools[].interface` の参照先。`check` のツールのインターフェース定義の有無を設計で確認する |
| ドキュメント | [docs/interface/IF-472-7.yaml](https://github.com/shuhei1101/mdmark/blob/4b89bc42/docs/interface/IF-472-7.yaml)・[docs/interface/IF-472-11.yaml](https://github.com/shuhei1101/mdmark/blob/4b89bc42/docs/interface/IF-472-11.yaml) | スキルが呼ぶ `setup.js` のサブコマンド | エージェントフローの `steps[].calls` の参照先 |
| ドキュメント | [docs/layout/LAY-472-1.yaml](https://github.com/shuhei1101/mdmark/blob/4b89bc42/docs/layout/LAY-472-1.yaml) | フォルダ構成 | 設計書のフォルダを新規追加する |
| 実装 | [src/plugin/mcp.ts](https://github.com/shuhei1101/mdmark/blob/4b89bc42/src/plugin/mcp.ts) | MCP サーバーの組み立て・ツールの登録・instructions | 設計書に合わせる |
| 実装 | [src/plugin/tools.ts](https://github.com/shuhei1101/mdmark/blob/4b89bc42/src/plugin/tools.ts) | ツールの定義と処理 | 設計書に合わせる |
| 実装 | [plugin/.mcp.json](https://github.com/shuhei1101/mdmark/blob/4b89bc42/plugin/.mcp.json) | Claude Code の接続先 | `connection` の根拠 |
| 実装 | [plugin/skills/global-setup/SKILL.md](https://github.com/shuhei1101/mdmark/blob/4b89bc42/plugin/skills/global-setup/SKILL.md) | `/mdmark:global-setup` のスキル | エージェントフローと一致させる |
| 実装 | [plugin/skills/setup/SKILL.md](https://github.com/shuhei1101/mdmark/blob/4b89bc42/plugin/skills/setup/SKILL.md) | `/mdmark:setup` のスキル | エージェントフローと一致させる |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 配信元の設定 | 反映作業『配布先の配信元の設定への種類の行の追加』の実行スクリプトを作業ブランチで実行し、`documents[]` に種類の行を追加する | knowledge のスキーマの参照のバージョンが他の行と違う場合の扱いは設計で決める |
| MCP サーバーの定義 | `docs/mcp-server/` に 1 枚作成する。`connection` は `plugin/.mcp.json`、`tools[]` は `src/plugin/tools.ts` が登録するツールから取り、`clients[]` は記載しない | エージェントの定義を持たないため `clients[]` を記載しない |
| ツールのインターフェース定義 | `tools[].interface` が指す先が無いツールは作成し、既存のものは `read_only`・`destructive` を確認する | - |
| スキルのエージェントフロー | `docs/agent-flow/` に `global-setup`・`setup` の 2 枚を `type: skill` で作成する。`steps[]` は今の SKILL.md の手順から取り、`steps[].calls` で `setup.js` のサブコマンドと MCP のツールを指す | 判定フローチャート『機能を呼ぶインターフェースの選び方』で、起動の仕組みを持たずプラグインで配布するためスキルにする |
| モジュール構成 | MCP サーバーとスキルの SKILL.md を作る処理の変更をモジュール構成に反映する | instructions の本文の配置先は [要件](./要件.mark.md) の `未確定` |
| 実装 | MCP サーバーの登録するツール・instructions と SKILL.md を設計書に一致させる | - |
| テスト | MCP サーバーのツールの一覧と SKILL.md が設計書と一致することを単体テストで確認する | - |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| インターフェース定義設計 | `4b89bc42..f3c7107d` | - |

## テスト結果

なし
