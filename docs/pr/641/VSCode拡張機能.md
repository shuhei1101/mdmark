# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| 実装 | [vscode/tests/integration/stub-server.ts](https://github.com/shuhei1101/mdmark/blob/e2d0e7d88db58a00b297bff6934c8a20b505fe57/vscode/tests/integration/stub-server.ts) | 拡張機能の結合テストが使用する代役のサーバー | complexity の違反 1 件（14） |
| 実装 | [tests/unit/vscode/src/webview/features/preview/panel/document-view.browser.test.ts](https://github.com/shuhei1101/mdmark/blob/e2d0e7d88db58a00b297bff6934c8a20b505fe57/tests/unit/vscode/src/webview/features/preview/panel/document-view.browser.test.ts) | Webview のプレビューの文書の表示の単体テスト | complexity の違反 1 件（11） |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| `stub-server.ts` | 要求の振り分けの分岐を、経路ごとの応答を返却する関数へ分けて complexity を 10 以下にする | 代役のサーバーが返却する応答は変えない |
| `document-view.browser.test.ts` | テストの本体から、分岐を持つ取得・照合の処理を関数へ分ける | 検証する値と期待値は変えない |

## テスト結果

未実施（『実装』『結合テスト作成』で記入する）
