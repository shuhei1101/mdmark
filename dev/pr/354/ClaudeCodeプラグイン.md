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
| スキル | `plugin/skills/global-setup/SKILL.md`・`plugin/skills/setup/SKILL.md` を直接置き、決まった処理はビルドが束ねる `plugin/bin/setup.js` を呼ぶ | dev-docs の `global-setup` を元にする |
| `global-setup` | 端末の設定のパスを決める → 移行か雛形から作成 → `settings.json` の `env` に `MDMARK_CONFIG`（既定と違うときだけ） → 常駐サーバーの起動と `tools/list` の確認 → フックの確認 → 結果を示す | 端末の設定のキーは 1 つずつ今の値と既定を示して確認してから書く |
| `setup` | 文書のフォルダの `mdmark.config.yaml` を、無ければ雛形から、あればキーごとに確認しながら作る・修正する | 雛形は `mdmark init` と同じものを使う |
| 常駐サーバーの起動 | tmux の `has-session` で既にあるかを確かめ、無ければ `new-session -d` で起動し、ポートが待ち受けるまで待つ。ログは状態の置き場所の `serve.log` に書く | [常駐サーバーを起動する](https://github.com/shuhei1101/mdmark/blob/feat/plugin/setup-skills/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E5%B8%B8%E9%A7%90%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC%E3%82%92%E8%B5%B7%E5%8B%95%E3%81%99%E3%82%8B.ts.yaml) |
| 起動の案内 | SessionStart のフックでポートを確かめ、待ち受けていないときだけ `global-setup` での起動の仕方を 1 行で伝える。起動しているときのセッション名は MCP の `instructions` に書く | [確認ログ](./確認ログ.md) |
| 状態の置き場所 | `MDMARK_STATE_DIR`、無ければ `${XDG_STATE_HOME:-~/.local/state}/mdmark` | - |
| tmux のセッション名 | 端末の設定の `serve.tmuxSession`（既定 `mdmark-mcp`） | - |

<!-- /table -->

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 複合ユースケース設計 | `66d1c0f7..77124c75` | - |
| 複合ユースケース設計 | `625da1fa..5f1e82ca` | レビューの指摘の修正 |
| 単一ユースケース設計 | `7801aeab..08d62964` | 複合ユースケースの異常シナリオが使う『端末にmdmarkをセットアップする』のシナリオを `正常シナリオ（常駐サーバーが止まっている）` に変えた |
| 単一ユースケース設計 | `1af74e0f..469d8523` | レビューの指摘の修正 |
| インターフェース定義設計 | `53c6d8b8..2ae95017` | 設定の設計書（`serve.tmuxSession`・`MDMARK_STATE_DIR` など）と、ライブラリ本体の『版を上げる』の `--settings` を含む |
| インターフェース定義設計 | `e44fedb2..81762b22` | レビューの指摘の修正。外部ライブラリ『tmux』を含む |
| モジュール構成設計 | `a522ccf5..6ef34652` | 規約『Claude プラグインルール』（複数のスキルが使う処理はプラグインの `bin/`）に合わせ、インターフェース定義の `scripts/setup.js` を `bin/setup.js` に変えた |
| モジュール構成設計 | `729fca78..9ccfdebc` | レビューの指摘の修正。物理ファイルごとの設計書に分けた |

## 実装

- 実装で決めたこと（モジュール構成に書いた）: `SetupError`（`exitCode` 1〜3）と `readYamlFile`（パス）、`hasTmux`・`hasSession`（状態）、`listConfigKeys` の `resolveRef`、`readPort` と待ち受けのポートの定数を `src/plugin/port.ts` へ移した（`setup.js` と SessionStart のフックが MCP サーバー全体を読み込まないため。`http.ts` から同じ名前で export し直している）、ビルドが `templates/mdmark.config.yaml` を `plugin/templates/` へ写す
- ビルドの移行の点検（`scripts/migrations.ts`）の対象に `mdmark.settings.schema.json` を足し、作業ツリーに無い Schema は比べないようにした。#347 で入った `no-steps.yaml` の端末の設定の Schema の行で、develop の `npm run build` が止まっていた
- 開発コマンド: 変えたのはビルドの入口と生成物で、`npm run build` のコマンドは変わらないため、開発コマンドのページは書き換えていない
- 束ねた `plugin/bin/setup.js` と `plugin/scripts/session-start.js` を手元でビルドして流し、`status`・`write-settings`・`keys`・`write-config`・`start-server`（tmux で `dist/cli.js serve` を起動し `tools/list` まで）と、待ち受けていないとき・いるときの SessionStart のフックを確かめた。束ねた生成物は、ほかのプラグインの生成物と同じくリリースで入れるため commit していない

## テスト結果

### 単体

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| `tests/unit/src/plugin/setup/`・`tests/unit/src/plugin/port.test.ts`・`tests/unit/src/plugin/session-start.test.ts` | 全実行 | 新規 | ✅ | `npm run test:unit` で 246 ファイル・1682 テストが全 pass<br>[テスト結果/20261107175056_940a2f96_単体テスト.log](./テスト結果/20261107175056_940a2f96_単体テスト.log) |
| `tests/unit/src/plugin/mcp.test.ts`・`tests/unit/src/cli/upgrade.test.ts` | 全実行 | 変更 | ✅ | 同上 |
| `tests/unit/src/plugin/setup/server.test.ts` の `test_start_server` | `test_start_server` | 変更 | ✅ | 起動するのはコミット済みの `dist/cli.js`（v0.9.0 のビルドで 6 つのツールを返す）のため、期待値を 3 つのツールを含むことにした |
| `tests/unit/src/plugin/setup/status.test.ts` の `test_read_terminal_status_when_unreadable` | `test_read_terminal_status_when_unreadable` | 変更 | ✅ | 設計書の「3 行目が YAML として読めない」に合わせ、端末の設定の内容を 3 行目で読めないものにした |
| `tests/unit/src/plugin/setup/server.test.ts` の `test_start_server_when_port_taken` | `test_start_server_when_port_taken` | 新規 | ✅ | レビューの指摘で追加。ほかのプロセスがポートを待ち受けていると起動しない<br>[テスト結果/20261107180547_09f60d1a_単体テスト.log](./テスト結果/20261107180547_09f60d1a_単体テスト.log) |
| `tests/unit/src/plugin/session-start.test.ts` の `test_run_session_start_when_hooks_json` | `test_run_session_start_when_hooks_json` | 変更 | ✅ | `5de11a9e` で、展開しない `${CLAUDE_PLUGIN_ROOT}` の文字列に Biome の警告を外す理由のコメントを足しただけで、確かめる中身は変えていない |

Red のログ（`2de9eb1e`）は `3fa99b49` で取った。その後の `3b5bd716` は Biome の整形だけで、テストの中身は変えていない。

develop（#353）の取り込みの後: `test_list_tool_names` の期待値を、常駐サーバーのツールが 6 つになったことに合わせて 3 つを含むことにした（`83fe7b97`）。単体テストは 1716 件が全 pass（[テスト結果/20261107183746_3a1be07a_単体テスト.log](./テスト結果/20261107183746_3a1be07a_単体テスト.log)。`tests/unit/src/viewer/` のブラウザのテスト 2 件が全件の実行の負荷で 1 回待ちを超えたため、流し直した結果を置いた）

lint: [テスト結果/20261107183746_3a1be07a_lint.log](./テスト結果/20261107183746_3a1be07a_lint.log)（違反は無し。警告は既存の `src/cli/embed.ts` の 2 件）
