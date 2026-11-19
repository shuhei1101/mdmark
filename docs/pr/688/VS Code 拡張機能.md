# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/interface/IF-472-15.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-15.ts.yaml) | HTML に書き出す | `test_normal_when_relative_mermaid` のケースを持つ。テストの誤りなら更新 |
| ドキュメント | [docs/interface/IF-472-22.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-22.ts.yaml) | プレビューを開く | `test_normal_when_mermaid` のケースを持つ。テストの誤りなら更新 |
| ドキュメント | [docs/module/MOD-472-102.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-102.ts.yaml) | 書き出し / embed.ts | 相対パスの `mermaid.url` を `data:` の URL に替える処理。実装の誤りなら更新 |
| 実装 | [vscode/src/export/embed.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/export/embed.ts) | 相対パスのライブラリ・`mermaid.url` を `bundle` でまとめて `data:` の URL に替える | まとめられないと `url` を削除する |
| 実装 | [vscode/src/export/export.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/export/export.ts) | 重ねた設定の相対パスを埋めて書き出す | - |
| テスト | [vscode/tests/integration/export.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/export.test.ts) | 書き出しの結合テスト | `test_normal_when_relative_mermaid` が fail |
| テスト | [vscode/tests/integration/preview-open.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/preview-open.test.ts) | プレビューを開く結合テスト | `test_normal_when_mermaid` が fail |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 原因 | [#630](https://github.com/shuhei1101/mdmark/pull/630)（[4d38ecc2](https://github.com/shuhei1101/mdmark/commit/4d38ecc2)）から、純粋な mermaid のコードブロックは map の図で描き、map で同じ図にできないときだけ mermaid の図に戻す。2 件のテストのフィクスチャの `flowchart LR` は map で描けるため mermaid の対象にならず、書き出しは `usesMermaid` が `false` を返して `mermaid.url` を削除し、プレビューは mermaid の図を描かない | 実装は #630 で決めた仕様どおりで、誤っているのはテストの前提 |
| インターフェース定義 | IF-472-15・IF-472-22 の 2 ケースの見本のワークスペースに、コードブロックの先頭の行に `%%{init: {}}%%` を記載すると書き足す | #630 がライブラリ本体のテスト（`tests/integration/lib/export.test.ts`・`bundle.test.ts`）で mermaid の図に戻すために使った行と同じ |
| 結合テスト | `export.test.ts` の `test_normal_when_relative_mermaid` と `preview-open.test.ts` の `test_normal_when_mermaid` のフィクスチャの `flowchart LR` の前に `%%{init: {}}%%` の行を足す | 実装は変えない |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| インターフェース定義設計 | `942f69e1..10b2a3f4` | - |

## テスト結果

未実行
