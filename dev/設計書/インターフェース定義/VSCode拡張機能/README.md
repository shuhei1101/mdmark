# VSCode拡張機能

VS Code 拡張機能のコマンド・Webview とのメッセージ・配布物のワークフロー

## 目次

<!-- table: data -->

| ページ | 概要 |
| --- | --- |
| [プレビューを開く.ts](./プレビューを開く.ts.yaml) | Markdown の横か同じ列に、読む版を決めて mdmark で描くプレビューを開く（mdmark.openPreviewToSide・mdmark.openPreview） |
| [プレビューを描き直す.ts](./プレビューを描き直す.ts.yaml) | Markdown・設定ファイルの書き換えと背面からの復帰で、最後の内容で描き直す |
| [プレビューをリロードする.ts](./プレビューをリロードする.ts.yaml) | 設定ファイルと読む版を決め直し、配布物を読み直して描く（mdmark.refreshPreview） |
| [スクロールを合わせる.ts](./スクロールを合わせる.ts.yaml) | エディタとプレビューのスクロールを、元の行番号で両方向に合わせる |
| [プレビューのリンクを開く.ts](./プレビューのリンクを開く.ts.yaml) | プレビューの外部の URL・Markdown・`#` のリンクを、種類ごとの先で開く |
| [設定ファイルを開く.ts](./設定ファイルを開く.ts.yaml) | 設定ファイルを開き、無ければ雛形を作るかを尋ねる（mdmark.openConfig） |
| [HTMLに書き出す.ts](./HTMLに書き出す.ts.yaml) | 開いている Markdown を jsDelivr の配布物で描く HTML に書き出す（mdmark.exportHtml） |
| [ブラウザで開く.ts](./ブラウザで開く.ts.yaml) | 書き出し直した HTML を既定のブラウザで開く（mdmark.openInBrowser） |
| [PDFに印刷する.ts](./PDFに印刷する.ts.yaml) | 描き終えた後に印刷のダイアログを出す HTML を書き出して開く（mdmark.printToPdf） |
| [拡張機能の配布物を作る.ts](./拡張機能の配布物を作る.ts.yaml) | `vscode-v*` のタグで .vsix を作り、GitHub Release に添える |
| [設定を開く.ts](./設定を開く.ts.yaml) | VS Code の設定画面を mdmark の項目に絞って開く（mdmark.openSettings） |

<!-- /table -->
