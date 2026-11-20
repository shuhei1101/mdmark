# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/interface/IF-472-15.ts.yaml](https://github.com/shuhei1101/mdmark/blob/f94aee03/docs/interface/IF-472-15.ts.yaml) | HTML に書き出す | `test_normal_when_relative_mermaid` のケースは、Markdown の先頭に `<!-- features: {"map": false} -->` を記載する見本 |
| ドキュメント | [docs/interface/IF-472-22.ts.yaml](https://github.com/shuhei1101/mdmark/blob/f94aee03/docs/interface/IF-472-22.ts.yaml) | プレビューを開く | `test_normal_when_mermaid` のケースは同上 |
| テスト | [vscode/tests/integration/export.test.ts](https://github.com/shuhei1101/mdmark/blob/f94aee03/vscode/tests/integration/export.test.ts) | 書き出しの結合テスト | フィクスチャが `%%{init: {}}%%` のままで、`test_normal_when_relative_mermaid` が fail |
| テスト | [vscode/tests/integration/preview-open.test.ts](https://github.com/shuhei1101/mdmark/blob/f94aee03/vscode/tests/integration/preview-open.test.ts) | プレビューを開く結合テスト | 同上で `test_normal_when_mermaid` が fail |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 原因 | [#747](https://github.com/shuhei1101/mdmark/pull/747) から `%%{init: {}}%%` を持つ mermaid のコードブロックも map で描く。2 件のフィクスチャの flowchart は map で描かれ、書き出しは `mermaid.url` を埋めず、プレビューは mermaid の図を描かない | 実装は #747 で決めた仕様どおりで、誤っているのはテストのフィクスチャ。ライブラリ本体の結合テストは #747 で `<!-- features: {"map": false} -->` に書き換え済み |
| 結合テスト | 2 件のフィクスチャの Markdown の先頭に `<!-- features: {"map": false} -->` を記載し、コードブロックの `%%{init: {}}%%` の行を削除する | インターフェース定義と実装は変えない |
