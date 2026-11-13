# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/module/MOD-472-9.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-9.yaml) | ClaudeCodeプラグイン / セットアップ / 全体のフォルダ構成（`src/plugin/`） | 更新対象 |
| ドキュメント | [docs/module/MOD-472-3.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-3.ts.yaml) | `session-start.ts` の要素 | 受け持ちのコメントの根拠。変更しない |
| 実装 | [src/plugin/session-start.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/session-start.ts) | SessionStart のフック | 変更しない |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| `MOD-472-9` の `directory` | `src/plugin/` の `port.ts` の次に `session-start.ts` の行を追加する（`port.ts` の待ち受けの確認を使用し、起動の案内先が `/mdmark:global-setup` のため） | 他の行は変えない |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| モジュール構成設計 | `934a668d..9fa83528` | dev-docs の配信元に無いため、YAML を直接編集した |

## テスト結果

### 単体

なし

### 結合

なし
