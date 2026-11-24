# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| 実装 | [plugin/guide-index.yaml](https://github.com/shuhei1101/mdmark/blob/f89d2f5acff20a8fbb667965494b68f0b5604851/plugin/guide-index.yaml) | ガイドの索引（`guides[]` の行が `docs/guide/` のページを指す） | 表のカスタム要素のガイドの行が無い |
| ドキュメント | [docs/module/MOD-472-14.ts.yaml](https://github.com/shuhei1101/mdmark/blob/f89d2f5acff20a8fbb667965494b68f0b5604851/docs/module/MOD-472-14.ts.yaml) | モジュール構成『プラグインのビルド / build-plugin.ts』。ビルドがガイドの索引を検査する | 検査の内容は変えない |
| ドキュメント | [docs/scenario/SC-472-15.yaml](https://github.com/shuhei1101/mdmark/blob/f89d2f5acff20a8fbb667965494b68f0b5604851/docs/scenario/SC-472-15.yaml) | 単一 UC『ガイドを参照する』 | 追加したページを参照できることを E2E で確認する |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| ガイドの索引 | `<mdmark-table>` の使用方法のページの行を `plugin/guide-index.yaml` に追加し、ページにタグ `topic:ガイド` を付ける | ページの中身は [ライブラリ本体](./ライブラリ本体.mark.md) のガイドの行 |
| MCP のツール | 追加しない（ガイドは dev-docs の `search_docs` で今の手順のまま参照する） | - |

## テスト結果

なし（テスト作成・実装で記入する）
