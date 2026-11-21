# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [project-index.yaml](https://github.com/shuhei1101/mdmark/blob/4b89bc42/project-index.yaml) | 配信元の設定 | `mcp_server`・`agent_flow` の種類の行が無い。knowledge のスキーマの参照は `design-schemas/v8.4.0` |
| ドキュメント | [docs/module/MOD-472-2.yaml](https://github.com/shuhei1101/mdmark/blob/4b89bc42/docs/module/MOD-472-2.yaml) | モジュール構成『ClaudeCodeプラグイン / MCPサーバー』 | MCP サーバーの定義から参照される |
| ドキュメント | [docs/module/MOD-472-9.yaml](https://github.com/shuhei1101/mdmark/blob/4b89bc42/docs/module/MOD-472-9.yaml) | モジュール構成『ClaudeCodeプラグイン / セットアップ / 全体』 | スキルの本文を受け持つ。エージェントフローから参照される |
| ドキュメント | [docs/interface/IF-472-4.ts.yaml](https://github.com/shuhei1101/mdmark/blob/4b89bc42/docs/interface/IF-472-4.ts.yaml) | インターフェース定義『MCPサーバーを起動・停止する』 | 接続の仕方の根拠 |
| ドキュメント | [docs/interface/IF-472-9.ts.yaml](https://github.com/shuhei1101/mdmark/blob/4b89bc42/docs/interface/IF-472-9.ts.yaml) ほか | ツールごとのインターフェース定義（`export_html`・`build_site`・`export_markdown`・`check`・`list_templates`・`add_template`・`apply_template`） | `tools[].interface` の参照先 |
| ドキュメント | [docs/interface/IF-472-7.ts.yaml](https://github.com/shuhei1101/mdmark/blob/4b89bc42/docs/interface/IF-472-7.ts.yaml)・[docs/interface/IF-472-11.ts.yaml](https://github.com/shuhei1101/mdmark/blob/4b89bc42/docs/interface/IF-472-11.ts.yaml) | スキルが呼ぶ `setup.js` のサブコマンド | エージェントフローの `steps[].calls` の参照先 |
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
| モジュール構成 | MCP サーバーがプロンプトファイルを読み込んで instructions とツールの description を描く処理と、スキルの SKILL.md を作る処理をモジュール構成に反映する | Jinja の描画は外部ライブラリ『@huggingface/jinja』を使用する |
| 実装 | MCP サーバーの登録するツール・instructions と SKILL.md を設計書に一致させる | - |
| テスト | MCP サーバーのツールの一覧と SKILL.md が設計書と一致することを単体テストで確認する | - |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| インターフェース定義設計 | `4b89bc42..f3c7107d` | - |
| エージェント・MCP サーバー設計 | `f3c7107d..eb653a98` | 配信元の設定への種類の行の追加と外部ライブラリの設計書を含む |
| エージェント・MCP サーバー設計 | `eb653a98..f9197096` | レビューの指摘の修正 |
| エージェントフロー・LLM 呼び出し設計 | `f9197096..d998ce2c` | - |
| エージェントフロー・LLM 呼び出し設計 | `14a51936..7073fe11` | レビューの指摘の修正 |
| モジュール構成設計 | `a9aba63b..da3a8d5f` | 外部ライブラリと MCP サーバーの定義の ID を起点 Issue の番号へ改名した（`LIB-775-1`・`MCP-775-1`）。フォルダ構成の設計書の更新を含む |
| モジュール構成設計 | `78fd2782..3cb9d051` | レビューの指摘の修正 |

## テスト結果

なし
