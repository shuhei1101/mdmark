# ClaudeCodeプラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/点検する.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E7%82%B9%E6%A4%9C%E3%81%99%E3%82%8B.ts.yaml) | MCP の `check` の入出力 | `kind` から語彙の 5 種類を外す |
| テスト | [tests/integration/ClaudeCodeプラグイン/check.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/integration/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/check.test.ts) | MCP の `check` の結合テスト | 索引の `schema` を上げる（案 A のとき） |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| MCP の `check` | 返すずれの種類から語彙の 5 種類を外す。引数・処理は変えない | `checkIndex` の変更に追随する |
| 使い方集 | `glossary`・`index-schema` の元のページ（`docs/` の下）の修正を、プラグインのビルドで使い方集に入れる | 元のページの修正は [要件](./要件.md) の更新ドキュメント |

## テスト結果

### 単体

なし

### 結合

なし
