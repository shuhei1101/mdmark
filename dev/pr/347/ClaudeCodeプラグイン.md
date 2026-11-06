# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/文書をHTMLに書き出す.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E6%96%87%E6%9B%B8%E3%82%92HTML%E3%81%AB%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%99.ts.yaml) / [複数の文書を1枚のHTMLにまとめる.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E8%A4%87%E6%95%B0%E3%81%AE%E6%96%87%E6%9B%B8%E3%82%921%E6%9E%9A%E3%81%AEHTML%E3%81%AB%E3%81%BE%E3%81%A8%E3%82%81%E3%82%8B.ts.yaml) / [点検する.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E7%82%B9%E6%A4%9C%E3%81%99%E3%82%8B.ts.yaml) | `export_html`・`build_site`・`check` | `config` の既定が `project_dir` から上へ探した最初の 1 つ |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/作業のフォルダを引数に入れる.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E4%BD%9C%E6%A5%AD%E3%81%AE%E3%83%95%E3%82%A9%E3%83%AB%E3%83%80%E3%82%92%E5%BC%95%E6%95%B0%E3%81%AB%E5%85%A5%E3%82%8C%E3%82%8B.ts.yaml) | PreToolUse のフックが `project_dir` を入れる | 探し方の起点の説明を持つ |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/MCPサーバー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC.ts.yaml) | MCP サーバーのツールの処理 | `runCheckTool` が `findConfigFile` を呼ぶ |
| 実装 | [src/plugin/tools.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/tools.ts) | ツールの定義と処理 | 59 行目の `CONFIG_DESCRIPTION` が最初に見つかった 1 つの前提 |
| テスト | [tests/integration/ClaudeCodeプラグイン/export-html.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/integration/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/export-html.test.ts) / [build-site.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/integration/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/build-site.test.ts) / [check.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/integration/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/check.test.ts) / [tests/unit/src/plugin/tools.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/src/plugin/tools.test.ts) | ツールのテスト | 重ねるテストは無い |
| テスト | [tests/e2e/単一ユースケース/ClaudeCodeから点検と書き出しを呼ぶ.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/ClaudeCode%E3%81%8B%E3%82%89%E7%82%B9%E6%A4%9C%E3%81%A8%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%97%E3%82%92%E5%91%BC%E3%81%B6.spec.ts) | シナリオの E2E | - |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| ツールの設定の読み方 | `export_html`・`build_site`・`check` は CLI と同じ共通の処理で探して重ねる | 探す起点は今と同じ `project_dir` |
| 端末の設定 | `mdmark serve` のプロセスの環境変数（`MDMARK_CONFIG`・`XDG_CONFIG_HOME`）で決め、ツールの引数では渡さない | 端末の設定を書き換えたら、次のツールの呼び出しから読み直す |
| ツールの説明文 | `config` の説明を、省いたときに探して重ねることに直す | - |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 複合ユースケース設計 | `197e33ad..1bae4810` | 3 つの対象システムにまたがる複合ユースケース |
| 複合ユースケース設計 | `a2dbc02d..ded2d0a3` | レビューの指摘の修正 |
| 単一ユースケース設計 | `c2bac536..1f7584fc` | - |
| 単一ユースケース設計 | `c6cb17ec..195452ca` | レビューの指摘の修正 |
| インターフェース定義設計 | `68b7a6df..01dd8ea0` | 設定の設計書を含む |
| インターフェース定義設計 | `4a1499cb..e9a450c0` | レビューの指摘の修正 |
| モジュール構成設計 | `65ead7b4..aca3eea0` | 確認ダイアログのボタンを「作成」にした修正（`73a94a2d`）を含む |

## テスト結果

### 単体

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| `tests/unit/src/plugin` | 全実行 | 実行のみ | ✅ | `npm run test:unit` で 238 ファイル・1649 テストが全 pass<br>[テスト結果/20261107012844_213fb845_単体テスト.log](./テスト結果/20261107012844_213fb845_単体テスト.log) |

### 結合

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| `tests/integration/ClaudeCodeプラグイン` | 全実行 | 実行のみ | ✅ | `npm run test:integration` を 1 回で流すとセッションの中で終わらないため、同じ projects を `--project` と Storybook の `--shard` に分けて全件流した（node 215・browser 230・Storybook 132+196+102、全 pass）<br>[テスト結果/20261107023918_966f7b64_結合テスト.log](./テスト結果/20261107023918_966f7b64_結合テスト.log) |

