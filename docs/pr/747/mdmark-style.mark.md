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

なし（テスト作成・実装で記入する）
