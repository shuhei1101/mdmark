# Claude Code プラグイン

## 現状

<!-- table: data -->

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/](https://github.com/shuhei1101/mdmark/tree/7a9367dd/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3) | フックと MCP のツールの入出力 | 文の単語の修正。`CSSのテンプレートの一覧を返す`・`設定のキーの一覧を返す`・`文書のフォルダの設定を書く`・`端末の設定を書く` の改名 |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/](https://github.com/shuhei1101/mdmark/tree/7a9367dd/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3) | モジュールの構成 | 文の単語の修正。`使い方集` の改名 |
| ドキュメント | [dev/設計書/設定/ClaudeCodeプラグイン.yaml](https://github.com/shuhei1101/mdmark/blob/7a9367dd/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E8%A8%AD%E5%AE%9A/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3.yaml) | MCP サーバーのポートとつなぐ先の説明 | 説明の単語の修正 |
| 実装 | [src/plugin/](https://github.com/shuhei1101/mdmark/tree/7a9367dd/src/plugin) | MCP サーバーとフック | コメントと、ツールのエラー・説明の文言の修正 |
| 実装 | [guide/](https://github.com/shuhei1101/mdmark/tree/7a9367dd/guide) | 使い方集の索引 | 索引の文の単語の修正 |
| 実装 | [plugin/](https://github.com/shuhei1101/mdmark/tree/7a9367dd/plugin) | プラグインの配布物・スキル・雛形 | スキル・雛形の単語の修正（ビルドで生成するファイルはビルドし直す） |
| テスト | [tests/integration/ClaudeCodeプラグイン/](https://github.com/shuhei1101/mdmark/tree/7a9367dd/tests/integration/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3) | プラグインの結合テスト | コメント・テストの名前・文言の期待値の修正 |

<!-- /table -->

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 単語の置き換え | [ライブラリ本体](./ライブラリ本体.md) と同じ決まりで置き換える | - |
| MCP のツール | ツールの説明とエラーの文言を修正する | ツール名と引数のキーは変えない |
| 配布物 | `plugin/` のうちビルドで生成するファイルは、修正した元からビルドし直す | - |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| インターフェース定義設計 | [7a9367dd..8d8ca21e](https://github.com/shuhei1101/mdmark/compare/7a9367dd...8d8ca21e) | ファイル名と参照の改名はドキュメント修正で行う |
| インターフェース定義設計 | [f828e525..05587ca2](https://github.com/shuhei1101/mdmark/compare/f828e525...05587ca2) | レビューの指摘の修正 |
| インターフェース定義設計 | [2a8e6a4e..55ada24b](https://github.com/shuhei1101/mdmark/compare/2a8e6a4e...55ada24b) | レビューの指摘の修正（外す・写し） |
| インターフェース定義設計 | [56f4a0d0..0d39c874](https://github.com/shuhei1101/mdmark/compare/56f4a0d0...0d39c874) | レビューの指摘の修正（状態と受け取りの外す） |

## テスト結果

未実施。
