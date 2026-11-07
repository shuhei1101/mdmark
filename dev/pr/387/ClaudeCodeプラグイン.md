# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/点検する.ts.yaml](https://github.com/shuhei1101/mdmark/blob/a2731a2c351c085e61ef715542fd92b4616e9eb6/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E7%82%B9%E6%A4%9C%E3%81%99%E3%82%8B.ts.yaml) | MCP の `check` | `text`・`file` で返却するずれの種類を更新対象 |
| 実装 | [src/plugin/tools.ts](https://github.com/shuhei1101/mdmark/blob/a2731a2c351c085e61ef715542fd92b4616e9eb6/src/plugin/tools.ts) | MCP のツールの説明 | `check` の説明の返却するずれの並びを更新対象 |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| MCP の `check` | `mdmark check` と同じ処理を呼ぶため、ライブラリ本体の点検の結論に合わせてツールの説明とインターフェース定義だけを修正する | 知らないキー・機能・指定のずれの種類を追加する |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| インターフェース定義設計 | `c957c9c4..25d5b068` | 点検する |

## テスト結果

なし
