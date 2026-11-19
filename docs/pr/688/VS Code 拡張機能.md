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
| 書き出しの `test_normal_when_relative_mermaid` | `config.mermaid.url` が `data:` の URL にならない原因（`bundle` の失敗・`usesMermaid` の判定・相対パスの解決のどれか）をログで特定し、誤っている側を直す | `未確定`: テストと実装のどちらを直すか（決める段: インターフェース定義設計） |
| プレビューの `test_normal_when_mermaid` | mermaid の配信のスタブ・CSP・Webview での mermaid の読み込みのどこで止まるかを特定し、誤っている側を直す | `未確定`: テストと実装のどちらを直すか（決める段: インターフェース定義設計） |

| 案 | 内容 |
| --- | --- |
| A | 実装を直し、テストの期待（インターフェース定義のケース）は変えない |
| B | テストの期待が誤っていれば、インターフェース定義のケースとテストを直す |

推奨: A

インターフェース定義のケースは利用者が期待する振る舞いを表すため、ケースに沿って動かない実装を先に疑う。

## テスト結果

未実行
