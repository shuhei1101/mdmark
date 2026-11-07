# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/作業のフォルダを引数に入れる.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E4%BD%9C%E6%A5%AD%E3%81%AE%E3%83%95%E3%82%A9%E3%83%AB%E3%83%80%E3%82%92%E5%BC%95%E6%95%B0%E3%81%AB%E5%85%A5%E3%82%8C%E3%82%8B.ts.yaml) | PreToolUse のフックが `project_dir` を入れる | 追加するツールも `project_dir` を受ける |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/MCPサーバーを起動・停止する.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC%E3%82%92%E8%B5%B7%E5%8B%95%E3%83%BB%E5%81%9C%E6%AD%A2%E3%81%99%E3%82%8B.ts.yaml) | `instructions` と `tools/list` | `instructions` がツールの一覧を持つ |
| ドキュメント | [dev/設計書/インターフェース定義/ライブラリ本体/設定を重ねて読む.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/%E3%83%A9%E3%82%A4%E3%83%96%E3%83%A9%E3%83%AA%E6%9C%AC%E4%BD%93/%E8%A8%AD%E5%AE%9A%E3%82%92%E9%87%8D%E3%81%AD%E3%81%A6%E8%AA%AD%E3%82%80.ts.yaml) | 端末の設定のパスと、最も近い `mdmark.config.yaml` の探し方 | テンプレートのフォルダと配置先の既定の元。変えない |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/MCPサーバー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC.ts.yaml) | ツールの定義（`TOOLS`）・`INSTRUCTIONS`・引数の検査 | `ToolDefinition.name` が 3 つのツールの型 |
| ドキュメント | [dev/設計書/モジュール構成/ライブラリ本体/設定を重ねて読む.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/%E3%83%A9%E3%82%A4%E3%83%96%E3%83%A9%E3%83%AA%E6%9C%AC%E4%BD%93/%E8%A8%AD%E5%AE%9A%E3%82%92%E9%87%8D%E3%81%AD%E3%81%A6%E8%AA%AD%E3%82%80.ts.yaml) | `resolveSettingsPath`・`findConfigChain` | 追加するツールから呼ぶ。変えない |
| ドキュメント | [dev/設計書/ER図/README.md](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/ER%E5%9B%B3/README.md) | 使う側が記載し mdmark が参照するデータの構造 | テンプレートの索引の ER 図（新規）を追加する |
| 実装 | [src/plugin/tools.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/tools.ts) | ツールの定義と処理 | `export_html`・`build_site`・`check` だけ |
| 実装 | [src/plugin/mcp.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/mcp.ts) | ツールの登録と `instructions` | - |
| 実装 | [src/config-files.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/config-files.ts) | 端末の設定のパス（`resolveSettingsPath`） | - |
| テスト | [tests/unit/src/plugin/tools.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/src/plugin/tools.test.ts) | ツールの単体テスト | テンプレートのテストは無い |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| テンプレートの索引 | `templates.yaml` の最上位に `schema`（整数、今は `1`）と `templates`（行の並び）を持ち、行は `name`・`file`・`description`・`tags` を持つ。JSON Schema を `schemas/` に追加し、ER 図を `dev/設計書/ER図/` に追加する | `file` はテンプレートのフォルダの直下のファイル名に限り、`/`・`..` を拒む |
| テンプレートのフォルダ | 端末の設定のパス（`resolveSettingsPath`）のフォルダの `templates/css/` | `MDMARK_CONFIG` で端末の設定を移すとテンプレートも移り、テストを一時フォルダに閉じられる |
| `list_templates` | 索引の行（`name`・`description`・`tags`・CSS の絶対パス）を返す。`annotations` は `readOnlyHint: true` | 索引がスキーマに合わないときは、合わない行とキーをツールのエラーにする |
| `add_template` | 引数 `file`（作業のフォルダの CSS のパス）・`name`・`description`・`tags`・`overwrite`。CSS をフォルダへコピーし、索引を検査してから書き込む | 同じ名前は `overwrite` が `true` のときだけ置き換える |
| `apply_template` | 引数 `name`・`dir`（配置先、省くと最も近い `mdmark.config.yaml` のフォルダ）・`overwrite`。CSS をコピーし、配置したパスと `theme` に記載する値（`dir` か `project_dir` から上へ探した `mdmark.config.yaml` のフォルダからの相対パス。設定ファイルが無ければ返さない）を返す | 設定ファイルの `theme` は書き換えない（`theme` は 1 つの CSS しか指せず、既にある値を黙って置き換えない）。配置先に同じ名前のファイルがあれば、`overwrite` が `true` のときだけ置き換える |
| エラーの文 | 既存のツールと同じく、何が合わないかと直し方を日本語の 1 文で返す | 名前が無い・同じ名前がある・CSS が無い・設定ファイルが見つからない |
| `instructions` | 使う側の CSS を探すときに `list_templates` を呼び、`apply_template` で配置して `theme` に記載する順序を追加する | - |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 複合ユースケース設計 | `66d1c0f7..25af29e6` | - |
| 単一ユースケース設計 | `fd91bf5d..f74e9295` | - |
| 単一ユースケース設計 | `ca96cc66..c7cc6f76` | レビューの指摘の修正 |
| インターフェース定義設計 | `33b4539d..b39a45b1` | ER 図と、MCP サーバーの起動・停止の `tools/list` と `instructions` を含む |
| インターフェース定義設計 | `305f35b0..d4d82194` | レビューの指摘の修正 |
| モジュール構成設計 | `13f31815..ac0ea2c9` | `apply_template` の `theme` が `./` で始まることをインターフェース定義にも反映 |
| モジュール構成設計 | `e7dce49a..5892a140` | レビューの指摘の修正 |
| モジュール構成設計 | `c127e0aa..344bda0e` | 実装で見つけたフックの対象ツールの漏れの修正（`PROJECT_DIR_TOOLS`・`hooks.json` の `matcher`・`test_create_mcp_server` の期待値） |

## テスト結果

ドキュメント修正（`docs/` の 5 ページ）は公開ドキュメントだけの変更で、規約『V字モデル』の対応表で関係する単体・結合テストが無いため、テストを回していない。

### 単体

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| `tests/unit/src/plugin/templates.test.ts` | 全実行 | 新規 | ✅ | 28 テスト pass<br>Red: [テスト結果/20261107135728_b8a91d61_単体テスト.log](./テスト結果/20261107135728_b8a91d61_%E5%8D%98%E4%BD%93%E3%83%86%E3%82%B9%E3%83%88.log)<br>Green: [テスト結果/20261107142144_6ab0c027_単体テスト.log](./テスト結果/20261107142144_6ab0c027_%E5%8D%98%E4%BD%93%E3%83%86%E3%82%B9%E3%83%88.log) |
| [tests/unit/src/plugin/tools.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/src/plugin/tools.test.ts) | 全実行 | 変更 | ✅ | `test_run_list_templates`・`test_run_add_template`・`test_run_apply_template` を追加 |
| [tests/unit/src/plugin/mcp.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/src/plugin/mcp.test.ts) / [http.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/src/plugin/http.test.ts) / [pre-tool-use.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/src/plugin/pre-tool-use.test.ts) | 全実行 | 変更 | ✅ | ツールが 6 つになった設計（`test_create_mcp_server`・`test_run_serve`・`test_run_pre_tool_use_when_matcher`）に期待値を合わせた |
| `tests/unit/` | 全実行 | 実行のみ | ✅ | `npm run test:unit` の 1680 テストのうち、今回触らない 2 件（`test_take_backup_when_outside`・`test_start_bundle`）が負荷で時間切れになり、ファイルを絞って流し直すと pass した<br>lint: [テスト結果/20261107142144_6ab0c027_lint.log](./テスト結果/20261107142144_6ab0c027_lint.log) |

直したテスト:

- `test_read_templates_index_when_unreadable`: 用意した索引が 4 行目（ファイルの末尾）で読めない形だったため、設計書の「3 行目に閉じていない括弧を持つ索引」に合わせて 3 行目を `tags: [a, b}` にした