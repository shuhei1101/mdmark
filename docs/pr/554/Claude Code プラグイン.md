# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/scenario/SC-472-3.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/scenario/SC-472-3.yaml) | Claude Code から点検と書き出しを呼ぶ | 既定で隠すことと、隠さない書き出しの指定を追加 |
| ドキュメント | [docs/interface/IF-472-9.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-9.ts.yaml) | `export_html` | 隠さない書き出しの引数を追加 |
| ドキュメント | [docs/interface/IF-472-13.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-13.ts.yaml) | `build_site` | 同上 |
| ドキュメント | [docs/module/MOD-472-48.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-48.ts.yaml) | MCP サーバー / `tools.ts` | ツールの引数を CLI の書き出しへ渡す |
| ドキュメント | [docs/module/MOD-472-49.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-49.ts.yaml) | MCP サーバー / `arguments.ts` | 引数の検査を追加 |
| 実装 | [src/plugin/tools.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/tools.ts) | `export_html`・`build_site` | CLI の `exportDocument`・`buildSite` を呼ぶ |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 既定と開発用の指定 | `export_html`・`build_site` は既定で隠し、CLI と同じ意味の隠さない書き出しの引数を追加する | 引数の名前はインターフェース定義設計で CLI と揃えて決める |
| 既存機能への影響 | 既存の引数・戻り値は変えない | - |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 単一ユースケース設計 | `de2762ce..d460d6c4` | - |
| 単一ユースケース設計 | `dccad6d4..6ff90b71` | レビューの指摘の修正 |
| 単一ユースケース設計 | `6ff90b71..0555f15f` | レビューの指摘の修正 |
| インターフェース定義設計 | `9846c106..ed6523a5` | - |
| インターフェース定義設計 | `b3623ac9..8e503d0b` | レビューの指摘の修正 |
| インターフェース定義設計 | `4bf0eb30..2db4bc72` | レビューの指摘の修正 |
| モジュール構成設計 | `2cc9f9e4..5cdeb894` | - |
| モジュール構成設計 | `4fabd371..70a751c9` | レビューの指摘の修正 |
| モジュール構成設計 | `df83135f..a6069a22` | 実装で分かった責務の移動 |
| モジュール構成設計 | `fdf6614f..a3ef2aa6` | 結合テストで分かった `collectMarkNames` の名前の漏れ |

## テスト結果

### 単体

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| [tests/unit/src/plugin/tools.test.ts](https://github.com/shuhei1101/mdmark/blob/d84a4f4a/tests/unit/src/plugin/tools.test.ts) | 全実行 | 変更 | ✅ | `test_run_export_html_when_keep_traces`・`test_run_build_site_when_keep_traces` を追加。ログは計画書『ライブラリ本体』の単体の表と同じ |

### 結合

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| [tests/integration/ClaudeCodeプラグイン/export-html.test.ts](https://github.com/shuhei1101/mdmark/blob/9cb6ad9b/tests/integration/ClaudeCodeプラグイン/export-html.test.ts) | 全実行 | 変更 | ✅ | `test_normal_when_traces_kept` を追加。ログは計画書『ライブラリ本体』の結合の表と同じ |
| [tests/integration/ClaudeCodeプラグイン/build-site.test.ts](https://github.com/shuhei1101/mdmark/blob/9cb6ad9b/tests/integration/ClaudeCodeプラグイン/build-site.test.ts) | 全実行 | 変更 | ✅ | `test_normal_when_traces_kept` を追加 |
