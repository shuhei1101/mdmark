# mdmark-style

## 用語の YAML から用語集の表を描く

### 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/module/MOD-472-356.ts.yaml](https://github.com/shuhei1101/mdmark/blob/fa2609d4/docs/module/MOD-472-356.ts.yaml) | mdmark-style / terms.ts | `mdmark.config.yaml` を起点に索引・エイリアス・用語集の表を読み込み、メッセージの本文と照合する |
| ドキュメント | [docs/interface/IF-472-46.ts.yaml](https://github.com/shuhei1101/mdmark/blob/fa2609d4/docs/interface/IF-472-46.ts.yaml) | 発言の用語にマーカーを付ける | 用語の集め方に YAML を指すマーカーを加えるか |
| ドキュメント | [docs/scenario/SC-472-98.yaml](https://github.com/shuhei1101/mdmark/blob/fa2609d4/docs/scenario/SC-472-98.yaml) | Claude Code の発言と返答の用語にマーカーを付ける | 同上 |
| 実装 | [src/mdmark-style/terms.ts](https://github.com/shuhei1101/mdmark/blob/fa2609d4/src/mdmark-style/terms.ts) | 用語の読み込みと照合 | 本文の表を囲む `glossary` のマーカーから用語を集める |

### 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 用語の集め方 | 表を囲まず YAML を指す `glossary` のマーカーからも、ライブラリ本体と同じ用語を集める | 推奨の案 B なら、mdmark-style は既にエイリアスを読み込んでいるため、YAML を指すマーカーを表の無いマーカーとして飛ばすだけで足りる。案は [要件](./要件.mark.md) で `未確定` |
