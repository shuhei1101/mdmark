# Claude Code プラグイン

## 現状

<!-- table: data -->

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/使い方集の索引を渡す.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E4%BD%BF%E3%81%84%E6%96%B9%E9%9B%86%E3%81%AE%E7%B4%A2%E5%BC%95%E3%82%92%E6%B8%A1%E3%81%99.ts.yaml) | SessionStart で使い方集の索引を `additionalContext` で渡す | 削除 |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/使い方集を読む.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E4%BD%BF%E3%81%84%E6%96%B9%E9%9B%86%E3%82%92%E8%AA%AD%E3%82%80.ts.yaml) | MCP の `read_guide` | 削除 |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/MCPサーバーを起動・停止する.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC%E3%82%92%E8%B5%B7%E5%8B%95%E3%83%BB%E5%81%9C%E6%AD%A2%E3%81%99%E3%82%8B.ts.yaml) | `mdmark serve` の起動と停止。使い方集を `mdmark serve` のパッケージから読む制約を持つ | 使い方集の制約を削除 |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/作業のフォルダを引数に入れる.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E4%BD%9C%E6%A5%AD%E3%81%AE%E3%83%95%E3%82%A9%E3%83%AB%E3%83%80%E3%82%92%E5%BC%95%E6%95%B0%E3%81%AB%E5%85%A5%E3%82%8C%E3%82%8B.ts.yaml) | PreToolUse の `matcher` の制約に `read_guide` を含めない旨がある | `read_guide` の記述を削除 |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/MCPサーバー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC.ts.yaml) | MCP サーバーの組み立て・ツール・instructions | `read_guide` の削除と instructions の書き換え |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/使い方集.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E4%BD%BF%E3%81%84%E6%96%B9%E9%9B%86.ts.yaml) | 使い方集の索引の検査と読み取り・索引の文・本文の読み取り | 本文の読み取りと SessionStart に渡す索引の文を削除し、ビルドの索引の検査だけを残す |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/フック.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E3%83%95%E3%83%83%E3%82%AF.ts.yaml) | SessionStart のフック | SessionStart のフックを削除 |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/プラグインのビルド.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3%E3%81%AE%E3%83%93%E3%83%AB%E3%83%89.ts.yaml) | 使い方集を `plugin/guide/` に書くビルド | `plugin/guide/` への使い方集の書き出しと SessionStart のフックの束ねを削除 |
| ドキュメント | [dev/設計書/ER図/使い方集.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/ER%E5%9B%B3/%E4%BD%BF%E3%81%84%E6%96%B9%E9%9B%86.yaml) | 使い方集の索引 `guide/index.yaml` | 指すページに `docs/files.yaml` でタグ `topic:使い方集` を付ける形に変更し、プラグインへの写しの記述を削除 |
| ドキュメント | [dev/設計書/外部ライブラリ/ClaudeCode.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E5%A4%96%E9%83%A8%E3%83%A9%E3%82%A4%E3%83%96%E3%83%A9%E3%83%AA/ClaudeCode.yaml) | プラグインの導入・SessionStart のフック | SessionStart のフックの記述を削除 |
| ドキュメント | [dev/設計書/外部ライブラリ/dev-docs.yaml](https://github.com/shuhei1101/mdmark/blob/chore/plugin/guide-dev-docs-source/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E5%A4%96%E9%83%A8%E3%83%A9%E3%82%A4%E3%83%96%E3%83%A9%E3%83%AA/dev-docs.yaml)（新規） | dev-docs の端末の設定・配信元の設定・`search_docs` | 使い方集を参照する先として採用する |
| 実装 | [src/plugin/guide.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/guide.ts) | 使い方集の索引の検査と読み取り・本文の読み取り・近い名前 | 本文の読み取りと近い名前を削除 |
| 実装 | [src/plugin/tools.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/tools.ts) | `read_guide`・`export_html`・`build_site`・`check` の定義と処理 | `read_guide` と、全てのツールが `true` になる `usesProjectDir` を削除 |
| 実装 | [src/plugin/mcp.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/mcp.ts) | MCP サーバーの組み立てと `INSTRUCTIONS` | instructions を書き換え |
| 実装 | [src/plugin/session-start.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/session-start.ts) | SessionStart のフックの入口 | 削除 |
| 実装 | [scripts/build-plugin.ts](https://github.com/shuhei1101/mdmark/blob/develop/scripts/build-plugin.ts) | プラグインのビルド | 変更 |
| 実装 | [plugin/hooks/hooks.json](https://github.com/shuhei1101/mdmark/blob/develop/plugin/hooks/hooks.json) | SessionStart と PreToolUse のフック | SessionStart のフックを削除 |
| 実装 | [guide/index.yaml](https://github.com/shuhei1101/mdmark/blob/develop/guide/index.yaml) | 使い方集の索引の正本 | 変えない（mdmark の配信元の `guide` の行の元） |
| テスト | [tests/integration/ClaudeCodeプラグイン/read-guide.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/integration/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/read-guide.test.ts) | `read_guide` の結合テスト | 削除 |
| テスト | [tests/integration/ClaudeCodeプラグイン/session-start.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/integration/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/session-start.test.ts) | SessionStart の結合テスト | 削除 |
| テスト | [tests/unit/src/plugin/guide.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/src/plugin/guide.test.ts)・[tests/unit/src/plugin/tools.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/src/plugin/tools.test.ts)・[tests/unit/src/plugin/mcp.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/src/plugin/mcp.test.ts)・[tests/unit/src/plugin/session-start.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/src/plugin/session-start.test.ts)・[tests/unit/scripts/build-plugin.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/scripts/build-plugin.test.ts) | プラグインの単体テスト | 変更 |
| テスト | [tests/e2e/単一ユースケース/使い方集を読む.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E4%BD%BF%E3%81%84%E6%96%B9%E9%9B%86%E3%82%92%E8%AA%AD%E3%82%80.spec.ts)・[tests/e2e/単一ユースケース/ClaudeCodeにプラグインを入れる.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/ClaudeCode%E3%81%AB%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3%E3%82%92%E5%85%A5%E3%82%8C%E3%82%8B.spec.ts) | 使い方集とプラグインの E2E | 変更 |
| テスト | [tests/e2e/単一ユースケース/セッションの開始で使い方集の索引を受け取る.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E3%82%BB%E3%83%83%E3%82%B7%E3%83%A7%E3%83%B3%E3%81%AE%E9%96%8B%E5%A7%8B%E3%81%A7%E4%BD%BF%E3%81%84%E6%96%B9%E9%9B%86%E3%81%AE%E7%B4%A2%E5%BC%95%E3%82%92%E5%8F%97%E3%81%91%E5%8F%96%E3%82%8B.spec.ts) | SessionStart の E2E | 削除 |
| テスト | [tests/e2e/単一ユースケース/MCPサーバーを起動・停止する.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC%E3%82%92%E8%B5%B7%E5%8B%95%E3%83%BB%E5%81%9C%E6%AD%A2%E3%81%99%E3%82%8B.spec.ts) | MCP サーバーの起動と停止の E2E | `read_guide` の確認とツールの数を修正 |

<!-- /table -->

## 変更方針

<!-- table: data -->

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 使い方集の参照先 | mdmark のクローン（develop の worktree）を登録した配信元 `mdmark` の `docs` の行を、タグ `topic:使い方集` で絞って参照する。プラグインはコピーも登録もしない | ほかのプロジェクトからは `search_docs` に `outside_scope: true` を指定する |
| `read_guide` | MCP のツール・処理・テストから削除する | 破壊的変更 |
| MCP の instructions | 使う場面・使わない場面・ツールの順序（書く前に dev-docs の `search_docs` で使い方集を参照 → 書く → `check` で点検、図は `diagram-check` の手順）を事実の文で記載する | 規約『注入文の書き分けと書き方』。instructions は 4,096 字以下 |
| 配信元の説明書 | mdmark の `dev-docs.yaml` の `instructions` に、使い方集の探し方（タグ `topic:使い方集` で絞って一覧を引く・`writing` と記法のページを読む）を記載する | instructions と同じ文を 2 か所に置かない |
| SessionStart | フックとその処理・テストを削除する | - |
| dev-docs が無いとき | MCP の instructions に、dev-docs が無い、または mdmark の配信元が登録されていないときは「dev-docs が無いので見つかりません」と記載する | - |
| 既存機能への影響 | `export_html`・`build_site`・`check` と PreToolUse のフックは変えない | - |

<!-- /table -->

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 複合ユースケース設計 | `5f5d0743..b0599a4d` | - |
| 複合ユースケース設計 | `b0599a4d..c01be231` | 使い方集の参照先と SessionStart の削除の確認事項の回答を反映 |
| 複合ユースケース設計 | `c01be231..e944c524` | レビューの指摘の修正 |
| 単一ユースケース設計 | `e944c524..c34f67b8` | - |
| インターフェース定義設計 | `c34f67b8..b3f44101` | - |
| インターフェース定義設計 | `e48f30bf..387b9f63` | レビューの指摘の修正 |
| モジュール構成設計 | `8d81e7de..df58aa0d` | - |

## テスト結果

なし
