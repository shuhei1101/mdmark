# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/module/MOD-472-3.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-3.ts.yaml) | `session-start.ts` の要素 | `directory` を持たない。更新対象 |
| 実装 | [src/plugin/session-start.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/session-start.ts) | SessionStart のフック | 変更しない |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| `MOD-472-3` の `directory` | `MOD-472-13`（pre-tool-use.ts）と同じ形で、`src/plugin/` の下に `session-start.ts` だけのツリーを追加する | 他のキーは変えない |

## テスト結果

### 単体

なし

### 結合

なし
