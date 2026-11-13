# Claude Code プラグイン

## 現状

<!-- table: data -->

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/interface/IF-472-5.ts.yaml](https://github.com/shuhei1101/mdmark/blob/2f65b61c8ca95c6223f34504bc9654b118d844f9/docs/interface/IF-472-5.ts.yaml) | インターフェース定義『作業のフォルダを引数に入れる』 | 制約「許可」・期待値・応答の例が `permissionDecision` を返却しないと定める |
| ドキュメント | [docs/module/MOD-472-13.ts.yaml](https://github.com/shuhei1101/mdmark/blob/2f65b61c8ca95c6223f34504bc9654b118d844f9/docs/module/MOD-472-13.ts.yaml) | モジュール構成『ClaudeCodeプラグイン / フック / pre-tool-use.ts』 | `runPreToolUse` の処理・説明と単体テストの期待値が `permissionDecision` を記載しないと定める |
| ドキュメント | [docs/library/LIB-472-1.yaml](https://github.com/shuhei1101/mdmark/blob/2f65b61c8ca95c6223f34504bc9654b118d844f9/docs/library/LIB-472-1.yaml) | 外部ライブラリ『ClaudeCode』 | フックの出力の `updatedInput` に「`permissionDecision` を記載しなければ許可の判定は変わらない」とある |
| 実装 | [src/plugin/pre-tool-use.ts](https://github.com/shuhei1101/mdmark/blob/2f65b61c8ca95c6223f34504bc9654b118d844f9/src/plugin/pre-tool-use.ts) | PreToolUse のフックの入口 | `updatedInput` だけを出力する |
| 実装 | [plugin/scripts/pre-tool-use.js](https://github.com/shuhei1101/mdmark/blob/2f65b61c8ca95c6223f34504bc9654b118d844f9/plugin/scripts/pre-tool-use.js) | まとめた PreToolUse のフック | ビルドで作り直す |
| 実装 | [plugin/hooks/hooks.json](https://github.com/shuhei1101/mdmark/blob/2f65b61c8ca95c6223f34504bc9654b118d844f9/plugin/hooks/hooks.json) | フックの定義 | `matcher` は作業のフォルダを使用する 6 つのツールの完全名。変えない |
| テスト | [tests/unit/src/plugin/pre-tool-use.test.ts](https://github.com/shuhei1101/mdmark/blob/2f65b61c8ca95c6223f34504bc9654b118d844f9/tests/unit/src/plugin/pre-tool-use.test.ts) | フックの単体テスト | `permissionDecision` が無いことを確認している |
| テスト | [tests/integration/ClaudeCodeプラグイン/pre-tool-use.test.ts](https://github.com/shuhei1101/mdmark/blob/2f65b61c8ca95c6223f34504bc9654b118d844f9/tests/integration/ClaudeCodeプラグイン/pre-tool-use.test.ts) | フックの結合テスト | `permissionDecision` が無いことを確認している |

<!-- /table -->

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| フックの出力 | `hookSpecificOutput` に `permissionDecision` と `permissionDecisionReason` を加え、`updatedInput` と一緒に返却する | 値はインターフェース定義設計で決める |
| 何も出力しない場合 | `CLAUDE_PROJECT_DIR` が無いか空のときは、今と同じく何も出力しない | - |
| 対象のツール | `hooks.json` の `matcher` は変えない | 権限の確認を省く値にするときは、自分の MCP のツールだけに絞っていることを制約に残す |
| 設計書 | インターフェース定義の制約「許可」・期待値・応答、モジュール構成の処理と単体テストの期待値、外部ライブラリの `updatedInput` の説明と `permissionDecision` の項目を出力に合わせる | - |
| テスト | 単体テスト・結合テストの `permissionDecision` が無いことの確認を、あることの確認に置き換える | - |
| 配布物 | `plugin/scripts/pre-tool-use.js` はこの PR では変えない | release の「配布物を入れる」commit でビルドして作り直す |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| インターフェース定義設計 | `61531030..0f622ca1` | - |
| インターフェース定義設計 | `b7ea7589..14fc3a31` | レビューの任意の指摘（`allow` の例外）の反映 |
| モジュール構成設計 | `14fc3a31..ed875d5a` | - |

## テスト結果

### 単体

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| `tests/unit/src/plugin/pre-tool-use.test.ts` | 全実行 | 変更 | ✅ | 4 テスト pass<br>`テスト結果/20261113091241_dbb79efc_単体テスト.log`（Red は `テスト結果/20261113091042_3c616da7_単体テスト.log`） |
| ほかの `tests/unit/` | 全実行 | 実行のみ | ✅ | 284 ファイル・2069 テスト pass（同じログ）<br>lint は `テスト結果/20261113091430_dbb79efc_lint.log` |

### 結合

なし（結合テスト作成の工程で記入する）
