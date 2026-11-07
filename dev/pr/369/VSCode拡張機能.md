# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/HTMLに書き出す.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/HTML%E3%81%AB%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%99.yaml) | 開いている Markdown を HTML に書き出して開く | 相対パスの `libraries`・`html-scripts.url` を使う文書のシナリオが無い |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/HTMLに書き出す.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/HTML%E3%81%AB%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%99.ts.yaml) | `mdmark.exportHtml` | 制約「設定と相対パス」が相対パスを `file:` の URL にし、その備考が知らせの枠になることを記載している |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/書き出し.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%97.ts.yaml) | 書き出し・ブラウザで開く・PDF に印刷 | `buildExportHtml` の設定は `libraries` を `file:` の URL にした値 |
| 実装 | [vscode/src/export/export.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/export/export.ts) | `readExportConfig`・`exportMarkdown` | `toUrl` が `pathToFileURL(target).href` |
| 実装 | [vscode/src/export/html.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/export/html.ts) | `buildExportHtml` | `extensions` だけを `data:` の URL にする |
| 実装 | [vscode/src/extensions-bundle.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/extensions-bundle.ts) | `bundleExtensions`（esbuild-wasm で ES モジュールにまとめる） | 相対パスの `libraries`・`html-scripts.url` のまとめにも使える |
| 実装 | [vscode/src/config.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/config.ts) | `resolveLibraries`・`resolveHtmlScripts` | 相対パスを `toUrl` で URL にする |
| テスト | [tests/unit/vscode/src/export/html.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/vscode/src/export/html.test.ts) / [tests/unit/vscode/src/extensions-bundle.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/vscode/src/extensions-bundle.test.ts) | HTML の組み立てとまとめの単体テスト | - |
| テスト | [tests/e2e/単一ユースケース/HTMLに書き出す.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/HTML%E3%81%AB%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%99.spec.ts) / [tests/e2e/単一ユースケース/PDFに印刷する.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/PDF%E3%81%AB%E5%8D%B0%E5%88%B7%E3%81%99%E3%82%8B.spec.ts) | シナリオの E2E | 相対パスの `libraries` を Chromium で開く手順が無い |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 相対パスの `libraries` | 文書にマーカーがある名前のモジュールだけを、`bundleExtensions` と同じ esbuild-wasm のまとめ方で ES モジュールにし、`data:text/javascript` の URL にして `config.libraries` の値に配置する | マーカーの検出は CLI と同じ処理（`usedLibraryMarks`）を使用する |
| 相対パスの `html-scripts.url` | 変換のライブラリを同じまとめ方で `data:` の URL にして `config["html-scripts"].url` に配置する | `未確定`（要件.md の `## 要望`。決める工程: インターフェース定義設計） |
| `http:`・`https:` の URL | 今のまま `config` に配置する | - |
| まとめられないモジュール | 埋めず、出力チャネルに警告を記録して書き出しを続ける | 開いたときは mdmark が知らせの枠を出す |
| 書き出しの共通の処理 | 「HTML に書き出す」「ブラウザで開く」「PDF に印刷する」が使う `readExportConfig` で埋めるため、3 つとも同じ HTML になる | - |
| テスト | 単体: 相対パスの値が `data:` の URL になり、`http:`・`https:` の値と、マーカーの無いライブラリが変わらないこと。E2E: 相対パスの `libraries` と `html-scripts.url` を持つワークスペースから書き出した HTML を Chromium で開き、知らせの枠が出ないこと | - |

## テスト結果

なし
