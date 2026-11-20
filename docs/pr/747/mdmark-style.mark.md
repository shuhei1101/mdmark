# mdmark-style

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/scenario/SC-472-97.yaml](https://github.com/shuhei1101/mdmark/blob/73fb0a1d/docs/scenario/SC-472-97.yaml) | ClaudeCodeの返答を共通スタイルで描く | Web で開く mdmark の文書と同じ外観で、ファイルツリーを描く |
| ドキュメント | [docs/interface/IF-472-45.tsx.yaml](https://github.com/shuhei1101/mdmark/blob/73fb0a1d/docs/interface/IF-472-45.tsx.yaml)・[docs/screen/SCR-472-5.tsx.yaml](https://github.com/shuhei1101/mdmark/blob/73fb0a1d/docs/screen/SCR-472-5.tsx.yaml) | 返答を共通スタイルで描く・ClaudeCodeの返答と発言 | ファイルツリーにする対象が言語 `tree` のコードブロックだけ |
| 実装 | [src/mdmark-style/blocks.ts](https://github.com/shuhei1101/mdmark/blob/73fb0a1d/src/mdmark-style/blocks.ts) | 返答のブロックの描き換え | 言語 `tree` のコードブロックをファイルツリーで描く |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 罫線の検知 | 言語が `tree` でないコードブロックの罫線の行が、ライブラリ本体と同じ基準以上なら、言語 `tree` と同じくファイルツリーで描く | 罫線の検知はライブラリ本体と同じ基準・同じ `tree_warning: false` の扱いにする |

## テスト結果

### 単体

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| `tests/unit/src/mdmark-style/blocks.test.ts` | 全実行 | 変更 | ✅ | 単体テストの全件の実行に含む<br>`テスト結果/20261121000756_a366dc9b_単体テスト.log` |

### 結合テストの実行範囲

| 変更したファイル | 結果 | 実行する結合テスト | 結合テストが無いエントリーポイント |
| --- | --- | --- | --- |
| `src/mdmark-style/blocks.ts` | R7 | `tests/integration/ClaudeCodeプラグイン/mdmark-style/render-reply.test.tsx` | - |
| `tests/unit/src/mdmark-style/blocks.test.ts` | R7（単体テストとその見本。結合テストが参照しない） | - | - |
| `tests/integration/ClaudeCodeプラグイン/mdmark-style/render-reply.test.tsx` | R2 | `tests/integration/ClaudeCodeプラグイン/mdmark-style/render-reply.test.tsx` | - |

`render-reply.test.tsx` はランナーに Claude Code の CLI が無いため、テスト実行方法の補足「Claude Code の mod の結合テスト」の `npm run test:mdmark-style -- render-reply.test.tsx` で手元で実行する。
