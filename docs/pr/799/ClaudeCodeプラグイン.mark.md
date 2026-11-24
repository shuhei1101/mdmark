# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| 実装 | [plugin/guide-index.yaml](https://github.com/shuhei1101/mdmark/blob/98824506ac4d6e77ec1e4b5e254f6e1bd0947161/plugin/guide-index.yaml) | ガイドの索引（`guides[]` の行が `docs/guide/` のページを指す） | 部品のカスタム要素のガイドの行が無い（表のカスタム要素の行はある） |
| ドキュメント | [docs/scenario/SC-472-15.yaml](https://github.com/shuhei1101/mdmark/blob/98824506ac4d6e77ec1e4b5e254f6e1bd0947161/docs/scenario/SC-472-15.yaml) | 単一 UC『ガイドを参照する』 | 追加したページを参照できることを E2E で確認する |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| ガイドの索引 | 部品のカスタム要素の使用方法のページの行を `plugin/guide-index.yaml` に追加し、ページにタグ `topic:ガイド` を付ける | ページの中身は [ライブラリ本体](./ライブラリ本体.mark.md) のガイドの行 |
| MCP のツール | 追加しない（ガイドは dev-docs の `search_docs` で今の手順のまま参照する） | - |

## テスト結果

なし（テスト作成・実装で記入する）
