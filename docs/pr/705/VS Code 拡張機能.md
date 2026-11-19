# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/scenario/SC-472-10.yaml](https://github.com/shuhei1101/mdmark/blob/feeade114e8ec6c06018ece012d121cae1a22136/docs/scenario/SC-472-10.yaml) | 単一 UC『VSCodeでプレビューを開く』 | 記述は変わらない |
| 実装 | [vscode/src/webview/features/preview/panel/document-view.ts](https://github.com/shuhei1101/mdmark/blob/feeade114e8ec6c06018ece012d121cae1a22136/vscode/src/webview/features/preview/panel/document-view.ts) | プレビューに文書を描く | 216 行目で、jsDelivr から読み込んだ配布物の `mount` を呼んで描く |
| 実装 | [vscode/src/webview/features/preview/panel/scroll.ts](https://github.com/shuhei1101/mdmark/blob/feeade114e8ec6c06018ece012d121cae1a22136/vscode/src/webview/features/preview/panel/scroll.ts) | エディタとプレビューのスクロールを合わせる | スクロールする場所が画面全体か要素かを分けて扱う |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| プレビュー | 拡張機能のコードは変えず、ライブラリ本体の修正を含む配布物で、プレビューの表の見出し行が留まることを確認する | 拡張機能の側の修正が要ると分かったときは、モジュール構成設計でこの計画書に追加する |
| 読み込む配布物 | プレビューは設定の `mdmark.version` が指すバージョンの配布物を読み込むため、利用者のプレビューで有効になるのは、この修正を含むバージョンのタグを打った後 | リポジトリの外部の作業は無い（タグは tester がスプリントの区切りで打つ） |

## テスト結果

なし（テスト作成・実装の工程で記入する）
