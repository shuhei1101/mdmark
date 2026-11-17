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

### 単体

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| [tests/unit/vscode/src/webview/features/preview/panel/document-view.browser.test.ts](https://github.com/shuhei1101/mdmark/blob/e2d0e7d88db58a00b297bff6934c8a20b505fe57/tests/unit/vscode/src/webview/features/preview/panel/document-view.browser.test.ts) | 全実行 | 変更 | ✅ | `テスト結果/20261117144844_982c79d4_単体テスト.log` |

### 結合

`vscode/tests/integration/stub-server.ts` の実行範囲は [ライブラリ本体](./ライブラリ本体.md) の `### 結合テストの実行範囲` に記載した。

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| [vscode/tests/integration/stub-server.ts](https://github.com/shuhei1101/mdmark/blob/e2d0e7d88db58a00b297bff6934c8a20b505fe57/vscode/tests/integration/stub-server.ts) | VS Code 拡張機能の結合テスト一式（VS Code 1.141.0） | 変更 | ❌ | 81 件 pass・2 件 fail（`export.test.ts` の `test_normal_when_relative_mermaid`・`preview-open.test.ts` の `test_normal_when_mermaid`）<br>`テスト結果/20261117150901_a879fd81_結合テスト.log` |

fail した 2 件は、どちらも mermaid の読み込み・書き出しの確認で、代役のサーバーのタグ一覧・配布物の振り分けを通らない（mermaid は別の代役のサーバーと手元の `node_modules/mermaid` から読み込む）。
`stub-server.ts` だけを origin/develop の内容に戻して同じコマンドを実行しても、同じ 2 件が同じエラーで fail した（ログの「切り分け」の節）。この 2 件は base ブランチの不具合で、この PR の変更によるものではないため、スコープ外に記載した。
fail で 1.141.0 の実行が終わったため、stable の VS Code では実行していない。
