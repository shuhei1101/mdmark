# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [設計書/インターフェース定義/ClaudeCodeプラグイン/文書を探す.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E6%96%87%E6%9B%B8%E3%82%92%E6%8E%A2%E3%81%99.ts.yaml) | `find_docs` の `text` | 「大文字と小文字を区別しない」。更新対象 |
| ドキュメント | [設計書/インターフェース定義/ClaudeCodeプラグイン/タグの語彙を見る.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E3%82%BF%E3%82%B0%E3%81%AE%E8%AA%9E%E5%BD%99%E3%82%92%E8%A6%8B%E3%82%8B.ts.yaml) | `list_tags` の `query` | 「大文字と小文字を区別しない」。更新対象 |
| ドキュメント | [設計書/モジュール構成/ClaudeCodeプラグイン/MCPサーバー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC.ts.yaml) | ツールの description | 更新対象 |
| 実装 | [src/plugin/tools.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/tools.ts) | `find_docs`・`list_tags` の description | 判定はライブラリ本体の `findDocs`・`listTags` が持つ |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| `find_docs` の `text` | ライブラリ本体の `findDocs` の正規化をそのまま使い、description の「大文字と小文字を区別しない」を正規化の説明にする | ツールの引数と結果の形は変えない |
| `list_tags` の `query` | ライブラリ本体の `listTags` の正規化をそのまま使い、description を同じく直す | 同上 |
| `check` | ライブラリ本体の `checkIndex` を使うため、`duplicate_term`・`avoided_term` の判定がそのまま変わる | ツールの記述は変えない |

## テスト結果

なし
