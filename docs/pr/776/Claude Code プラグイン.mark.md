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

### ドキュメント修正

なし（配信元の設定 `project-index.yaml` への `prompts` の行と `converters[]` の追加だけで、規約『V字モデル』の対応表で対応する単体・結合テストが無い）

### 単体

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| `tests/unit/src/plugin/prompt.test.ts` | 全実行 | 新規 | ✅ | 9 テスト pass<br>`テスト結果/20261121195115_b4592ba_単体テスト.log` |
| `tests/unit/scripts/skill-md.test.ts` | 全実行 | 新規 | ✅ | 5 テスト pass（レビューの指摘でコマンドの行の期待値を修正）<br>`テスト結果/20261121195115_b4592ba_単体テスト.log` |
| [tests/unit/src/plugin/mcp.test.ts](https://github.com/shuhei1101/mdmark/blob/4b89bc42/tests/unit/src/plugin/mcp.test.ts) | 全実行 | 変更 | ✅ | `test_create_mcp_server` を設計書に合わせ、`test_load_server_prompts`・`test_load_server_prompts_when_prompt_missing` を追加<br>`テスト結果/20261121195115_b4592ba_単体テスト.log` |
| [tests/unit/src/plugin/tools.test.ts](https://github.com/shuhei1101/mdmark/blob/4b89bc42/tests/unit/src/plugin/tools.test.ts) | 全実行 | 変更 | ✅ | ツールの定義から `description` を外し `annotations` を必須にしたことに合わせ、補助関数を修正<br>`テスト結果/20261121195115_b4592ba_単体テスト.log` |
| 単体テスト（フロント）の全件 | 全実行 | 実行のみ | ✅ | ランナーで Test Files 333・Tests 2798 が pass<br>Red: `テスト結果/20261121192830_653a3c5_単体テスト.log`<br>lint: `テスト結果/20261121194900_b4592ba_lint.log` |

実装の前に直したテスト: 結合テスト [tests/integration/ClaudeCodeプラグイン/serve.test.ts](https://github.com/shuhei1101/mdmark/blob/4b89bc42/tests/integration/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/serve.test.ts) の `test_normal` が削除した定数 `INSTRUCTIONS` を参照して型検査が通らなかったため、期待値を設計書（instructions はプロンプトファイルから描く）に合わせて `loadServerPrompts` で描いた文にした（6c66defc。実装と別の commit）。結合テストの実行は結合テスト作成の工程で行う。

### 結合テストの実行範囲

<!-- table: {"kind": "data"} -->

| 変更したファイル | 結果 | 実行する結合テスト | 結合テストが無いエントリーポイント |
| --- | --- | --- | --- |
| `content/prompts/mcp/mdmark/instructions.yaml` | R7 | `tests/integration/ClaudeCodeプラグイン/serve.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/setup-start-server.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/check.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-html.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-markdown.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/build-site.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/list-templates.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/add-template.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/apply-template.test.ts` | - |
| `content/prompts/mcp/mdmark/tools/add-template.yaml` | R7 | `tests/integration/ClaudeCodeプラグイン/serve.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/setup-start-server.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/check.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-html.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-markdown.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/build-site.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/list-templates.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/add-template.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/apply-template.test.ts` | - |
| `content/prompts/mcp/mdmark/tools/apply-template.yaml` | R7 | `tests/integration/ClaudeCodeプラグイン/serve.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/setup-start-server.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/check.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-html.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-markdown.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/build-site.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/list-templates.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/add-template.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/apply-template.test.ts` | - |
| `content/prompts/mcp/mdmark/tools/build-site.yaml` | R7 | `tests/integration/ClaudeCodeプラグイン/serve.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/setup-start-server.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/check.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-html.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-markdown.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/build-site.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/list-templates.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/add-template.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/apply-template.test.ts` | - |
| `content/prompts/mcp/mdmark/tools/check.yaml` | R7 | `tests/integration/ClaudeCodeプラグイン/serve.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/setup-start-server.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/check.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-html.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-markdown.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/build-site.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/list-templates.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/add-template.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/apply-template.test.ts` | - |
| `content/prompts/mcp/mdmark/tools/export-html.yaml` | R7 | `tests/integration/ClaudeCodeプラグイン/serve.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/setup-start-server.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/check.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-html.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-markdown.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/build-site.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/list-templates.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/add-template.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/apply-template.test.ts` | - |
| `content/prompts/mcp/mdmark/tools/export-markdown.yaml` | R7 | `tests/integration/ClaudeCodeプラグイン/serve.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/setup-start-server.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/check.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-html.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-markdown.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/build-site.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/list-templates.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/add-template.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/apply-template.test.ts` | - |
| `content/prompts/mcp/mdmark/tools/list-templates.yaml` | R7 | `tests/integration/ClaudeCodeプラグイン/serve.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/setup-start-server.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/check.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-html.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-markdown.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/build-site.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/list-templates.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/add-template.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/apply-template.test.ts` | - |
| `docs/agent-flow/global-setup.yaml` | R7 | - | - |
| `docs/agent-flow/index.yaml` | R7 | - | - |
| `docs/agent-flow/setup.yaml` | R7 | - | - |
| `docs/dev-command/CMD-472-1.yaml` | R7 | - | - |
| `docs/index.yaml` | R7 | - | - |
| `docs/interface/IF-472-1.ts.yaml` | R7 | - | - |
| `docs/interface/IF-472-10.ts.yaml` | R7 | - | - |
| `docs/interface/IF-472-13.ts.yaml` | R7 | - | - |
| `docs/interface/IF-472-2.ts.yaml` | R7 | - | - |
| `docs/interface/IF-472-3.ts.yaml` | R7 | - | - |
| `docs/interface/IF-472-50.ts.yaml` | R7 | - | - |
| `docs/interface/IF-472-9.ts.yaml` | R7 | - | - |
| `docs/layout/LAY-472-1.yaml` | R7 | - | - |
| `docs/library/LIB-775-1.yaml` | R7 | - | - |
| `docs/library/index.yaml` | R7 | - | - |
| `docs/mcp-server/MCP-775-1.yaml` | R7 | - | - |
| `docs/mcp-server/index.yaml` | R7 | - | - |
| `docs/module/MOD-472-14.ts.yaml` | R7 | - | - |
| `docs/module/MOD-472-2.yaml` | R7 | - | - |
| `docs/module/MOD-472-48.ts.yaml` | R7 | - | - |
| `docs/module/MOD-472-50.ts.yaml` | R7 | - | - |
| `docs/module/MOD-472-51.ts.yaml` | R7 | - | - |
| `docs/module/MOD-775-1.ts.yaml` | R7 | - | - |
| `docs/module/MOD-775-2.ts.yaml` | R7 | - | - |
| `docs/module/index.yaml` | R7 | - | - |
| `docs/pr/776/Claude Code プラグイン.mark.md` | R7 | - | - |
| `docs/pr/776/README.mark.md` | R7 | - | - |
| `docs/pr/776/タスク一覧.yaml` | R7 | - | - |
| `docs/pr/776/テスト結果/20261121192830_653a3c5_単体テスト.log` | R7 | - | - |
| `docs/pr/776/テスト結果/20261121193631_6c66def_lint.log` | R7 | - | - |
| `docs/pr/776/テスト結果/20261121193908_6c66def_単体テスト.log` | R7 | - | - |
| `docs/pr/776/テスト結果/20261121194900_b4592ba_lint.log` | R7 | - | - |
| `docs/pr/776/テスト結果/20261121195115_b4592ba_単体テスト.log` | R7 | - | - |
| `docs/pr/776/反映作業/index.yaml` | R7 | - | - |
| `docs/pr/776/反映作業/配信元の設定への種類の行の追加/dry-run.log` | R7 | - | - |
| `docs/pr/776/反映作業/配信元の設定への種類の行の追加/実行.py` | R7 | - | - |
| `docs/pr/776/反映作業/配信元の設定への種類の行の追加/疎通確認.py` | R7 | - | - |
| `docs/pr/776/反映作業/配信元の設定への種類の行の追加/確認.py` | R7 | - | - |
| `docs/pr/776/要件.mark.md` | R7 | - | - |
| `docs/pr/776/要件.yaml` | R7 | - | - |
| `package-lock.json` | R7 | `tests/integration/ClaudeCodeプラグイン/serve.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/setup-start-server.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/check.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-html.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-markdown.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/build-site.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/list-templates.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/add-template.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/apply-template.test.ts` | - |
| `package.json` | R7 | `tests/integration/ClaudeCodeプラグイン/serve.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/setup-start-server.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/check.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-html.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-markdown.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/build-site.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/list-templates.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/add-template.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/apply-template.test.ts` | - |
| `plugin/skills/global-setup/SKILL.md` | R7 | - | スキルの SKILL.md（単体テスト `test_skill_md_matches_repository` で確認する） |
| `plugin/skills/setup/SKILL.md` | R7 | - | スキルの SKILL.md（単体テスト `test_skill_md_matches_repository` で確認する） |
| `project-index.yaml` | R7 | - | - |
| `scripts/build-plugin.ts` | R7 | - | スキルの SKILL.md（単体テスト `test_skill_md_matches_repository` で確認する） |
| `scripts/files.yaml` | R7 | - | - |
| `scripts/skill-md.ts` | R7 | - | スキルの SKILL.md（単体テスト `test_skill_md_matches_repository` で確認する） |
| `src/files.yaml` | R7 | - | - |
| `src/plugin/http.ts` | R7 | `tests/integration/ClaudeCodeプラグイン/serve.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/setup-start-server.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/check.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-html.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-markdown.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/build-site.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/list-templates.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/add-template.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/apply-template.test.ts` | - |
| `src/plugin/mcp.ts` | R7 | `tests/integration/ClaudeCodeプラグイン/serve.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/setup-start-server.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/check.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-html.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-markdown.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/build-site.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/list-templates.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/add-template.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/apply-template.test.ts` | - |
| `src/plugin/prompt.ts` | R7 | `tests/integration/ClaudeCodeプラグイン/serve.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/setup-start-server.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/check.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-html.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-markdown.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/build-site.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/list-templates.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/add-template.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/apply-template.test.ts` | - |
| `src/plugin/tools.ts` | R7 | `tests/integration/ClaudeCodeプラグイン/serve.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/setup-start-server.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/check.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-html.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-markdown.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/build-site.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/list-templates.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/add-template.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/apply-template.test.ts` | - |
| `tests/files.yaml` | R7 | - | - |
| `tests/integration/ClaudeCodeプラグイン/add-template.test.ts` | R2 | `tests/integration/ClaudeCodeプラグイン/add-template.test.ts` | - |
| `tests/integration/ClaudeCodeプラグイン/apply-template.test.ts` | R2 | `tests/integration/ClaudeCodeプラグイン/apply-template.test.ts` | - |
| `tests/integration/ClaudeCodeプラグイン/build-site.test.ts` | R2 | `tests/integration/ClaudeCodeプラグイン/build-site.test.ts` | - |
| `tests/integration/ClaudeCodeプラグイン/check.test.ts` | R2 | `tests/integration/ClaudeCodeプラグイン/check.test.ts` | - |
| `tests/integration/ClaudeCodeプラグイン/export-html.test.ts` | R2 | `tests/integration/ClaudeCodeプラグイン/export-html.test.ts` | - |
| `tests/integration/ClaudeCodeプラグイン/export-markdown.test.ts` | R2 | `tests/integration/ClaudeCodeプラグイン/export-markdown.test.ts` | - |
| `tests/integration/ClaudeCodeプラグイン/list-templates.test.ts` | R2 | `tests/integration/ClaudeCodeプラグイン/list-templates.test.ts` | - |
| `tests/integration/built-root.ts` | R7 | `tests/integration/ClaudeCodeプラグイン/serve.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/setup-start-server.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/check.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-html.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-markdown.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/build-site.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/list-templates.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/add-template.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/apply-template.test.ts` | - |
| `tests/integration/plugin.ts` | R7 | `tests/integration/ClaudeCodeプラグイン/serve.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/setup-start-server.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/check.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-html.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/export-markdown.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/build-site.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/list-templates.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/add-template.test.ts`<br>`tests/integration/ClaudeCodeプラグイン/apply-template.test.ts` | - |
| `tests/integration/ClaudeCodeプラグイン/serve.test.ts` | R2 | `tests/integration/ClaudeCodeプラグイン/serve.test.ts` | - |
| `tests/unit/scripts/skill-md.test.ts` | R7 | - | - |
| `tests/unit/src/plugin/mcp.test.ts` | R7 | - | - |
| `tests/unit/src/plugin/prompt.test.ts` | R7 | - | - |
| `tests/unit/src/plugin/tools.test.ts` | R7 | - | - |

<!-- /table -->

層に `excluded_paths`・`folder_map` が無く全てのファイルが R7 になるため、`mdmark serve` の起動時にプロンプトファイルを読み込んで instructions とツールの説明を描くファイルに、`mdmark serve` を起動する結合テストを当てた。文書・管理用の YAML・単体テストは実行に影響しない。
結合テストの補助 `tests/integration/plugin.ts` の `copyBuiltPackage` と `tests/integration/built-root.ts` の `createBuiltRoot` は `content/prompts/` をコピーしないため、結合テスト作成の工程で直してから実行する。
