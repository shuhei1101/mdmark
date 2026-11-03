# Claude Code プラグイン

## 現状

<!-- table: data -->

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/使い方集の索引を渡す.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E4%BD%BF%E3%81%84%E6%96%B9%E9%9B%86%E3%81%AE%E7%B4%A2%E5%BC%95%E3%82%92%E6%B8%A1%E3%81%99.ts.yaml) | SessionStart で使い方集の索引を `additionalContext` で渡す | その時点で変わる事実だけを渡す定義に変更 |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/使い方集を読む.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E4%BD%BF%E3%81%84%E6%96%B9%E9%9B%86%E3%82%92%E8%AA%AD%E3%82%80.ts.yaml) | MCP の `read_guide` | 削除 |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/MCPサーバーを起動・停止する.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC%E3%82%92%E8%B5%B7%E5%8B%95%E3%83%BB%E5%81%9C%E6%AD%A2%E3%81%99%E3%82%8B.ts.yaml) | `mdmark serve` の起動と停止。使い方集を `mdmark serve` のパッケージから読む制約を持つ | 使い方集の制約を削除 |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/作業のフォルダを引数に入れる.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E4%BD%9C%E6%A5%AD%E3%81%AE%E3%83%95%E3%82%A9%E3%83%AB%E3%83%80%E3%82%92%E5%BC%95%E6%95%B0%E3%81%AB%E5%85%A5%E3%82%8C%E3%82%8B.ts.yaml) | PreToolUse の `matcher` の制約に `read_guide` を含めない旨がある | `read_guide` の記述を削除 |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/MCPサーバー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC.ts.yaml) | MCP サーバーの組み立て・ツール・instructions | `read_guide` の削除と instructions の書き換え |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/使い方集.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E4%BD%BF%E3%81%84%E6%96%B9%E9%9B%86.ts.yaml) | 使い方集の索引の検査と読み取り・索引の文・本文の読み取り | 配信元へのコピーと登録に作り替える |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/フック.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E3%83%95%E3%83%83%E3%82%AF.ts.yaml) | SessionStart のフック | その時点で変わる事実を渡す処理に変更 |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/プラグインのビルド.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3%E3%81%AE%E3%83%93%E3%83%AB%E3%83%89.ts.yaml) | 使い方集を `plugin/guide/` に書くビルド | 配信元に置くファイル（配信元の設定・管理用の YAML）の生成を追加 |
| ドキュメント | [dev/設計書/ER図/使い方集.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/ER%E5%9B%B3/%E4%BD%BF%E3%81%84%E6%96%B9%E9%9B%86.yaml) | 使い方集の索引 `guide/index.yaml` | 配信元の文書のメタデータとして持つ形に変更 |
| ドキュメント | [dev/設計書/外部ライブラリ/ClaudeCode.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E5%A4%96%E9%83%A8%E3%83%A9%E3%82%A4%E3%83%96%E3%83%A9%E3%83%AA/ClaudeCode.yaml) | プラグインの導入・SessionStart のフック | SessionStart の用途を更新 |
| ドキュメント | `dev/設計書/外部ライブラリ/dev-docs.yaml`（新規） | dev-docs の端末の設定・配信元の設定・`search_docs` | 使い方集を配る先として採用する |
| 実装 | [src/plugin/guide.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/guide.ts) | 使い方集の索引の検査と読み取り・本文の読み取り・近い名前 | 本文の読み取りと近い名前を削除し、コピーと登録を追加 |
| 実装 | [src/plugin/tools.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/tools.ts) | `read_guide`・`export_html`・`build_site`・`check` の定義と処理 | `read_guide` を削除 |
| 実装 | [src/plugin/mcp.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/mcp.ts) | MCP サーバーの組み立てと `INSTRUCTIONS` | instructions を書き換え |
| 実装 | [src/plugin/session-start.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/session-start.ts) | SessionStart のフックの入口 | 変更 |
| 実装 | [scripts/build-plugin.ts](https://github.com/shuhei1101/mdmark/blob/develop/scripts/build-plugin.ts) | プラグインのビルド | 変更 |
| 実装 | [plugin/hooks/hooks.json](https://github.com/shuhei1101/mdmark/blob/develop/plugin/hooks/hooks.json) | SessionStart と PreToolUse のフック | 必要に応じて変更 |
| 実装 | [guide/index.yaml](https://github.com/shuhei1101/mdmark/blob/develop/guide/index.yaml) | 使い方集の索引の正本 | 配信元の文書のメタデータの元にする |
| テスト | [tests/integration/ClaudeCodeプラグイン/read-guide.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/integration/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/read-guide.test.ts) | `read_guide` の結合テスト | 削除 |
| テスト | [tests/integration/ClaudeCodeプラグイン/session-start.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/integration/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/session-start.test.ts) | SessionStart の結合テスト | 変更 |
| テスト | [tests/unit/src/plugin/guide.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/src/plugin/guide.test.ts)・[tests/unit/src/plugin/tools.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/src/plugin/tools.test.ts)・[tests/unit/src/plugin/mcp.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/src/plugin/mcp.test.ts)・[tests/unit/src/plugin/session-start.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/src/plugin/session-start.test.ts)・[tests/unit/scripts/build-plugin.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/scripts/build-plugin.test.ts) | プラグインの単体テスト | 変更 |
| テスト | [tests/e2e/単一ユースケース/使い方集を読む.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E4%BD%BF%E3%81%84%E6%96%B9%E9%9B%86%E3%82%92%E8%AA%AD%E3%82%80.spec.ts)・[tests/e2e/単一ユースケース/セッションの開始で使い方集の索引を受け取る.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E3%82%BB%E3%83%83%E3%82%B7%E3%83%A7%E3%83%B3%E3%81%AE%E9%96%8B%E5%A7%8B%E3%81%A7%E4%BD%BF%E3%81%84%E6%96%B9%E9%9B%86%E3%81%AE%E7%B4%A2%E5%BC%95%E3%82%92%E5%8F%97%E3%81%91%E5%8F%96%E3%82%8B.spec.ts)・[tests/e2e/単一ユースケース/ClaudeCodeにプラグインを入れる.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/ClaudeCode%E3%81%AB%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3%E3%82%92%E5%85%A5%E3%82%8C%E3%82%8B.spec.ts) | 使い方集とプラグインの E2E | 変更 |

<!-- /table -->

## 変更方針

<!-- table: data -->

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 使い方集の置き場所 | プラグインのバージョンごとに変わらない Git 管理外の決まった場所（例: `~/.local/share/mdmark/guide/`）へ、ビルドで生成した配信元の設定・管理用の YAML と使い方集のページをコピーする | 置き場所のパスと環境変数での上書きはインターフェース定義設計で決める |
| 配信元の登録 | dev-docs の端末の設定の `sources[]` に、コピー先の配信元の設定を `scope.read: ["/**"]` で登録し、dev-docs に読み直させる | 実行する場所は `要件.md` の `未確定`（単一ユースケース設計で決める） |
| `read_guide` | MCP のツール・処理・テストから削除する | 破壊的変更 |
| MCP の instructions | 使う場面・使わない場面・ツールの順序（書く前に dev-docs の `search_docs` で使い方集を参照 → 書く → `check` で点検、図は `diagram-check` の手順）を事実の文で記載する | 規約『注入文の書き分けと書き方』。instructions は 4,096 字以下 |
| 配信元の説明書 | 使い方集の配信元の設定の `instructions` に、使い方集の探し方（一覧を引く・`writing` と記法のページを読む）を記載する | instructions と同じ文を 2 か所に置かない |
| SessionStart | 索引の表を渡さず、その時点で変わる事実だけを渡す | 中身は `要件.md` の `未確定`（インターフェース定義設計で決める）。1,000 字以内 |
| dev-docs が無いとき | 使い方集を探す時点で「dev-docs が無いので見つかりません」と分かるようにする | dev-docs の有無は端末の設定ファイルの有無で判定する |
| 既存機能への影響 | `export_html`・`build_site`・`check` と PreToolUse のフックは変えない | - |

<!-- /table -->

## テスト結果

なし
