# VS Code 拡張機能

## 現状

<!-- table: data -->

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/プレビューを開く.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E9%96%8B%E3%81%8F.ts.yaml) | プレビューの HTML と CSP | `media-src` と、相対パスの動画・音声の解決を追加する |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/プレビュー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC.ts.yaml) | パネルの HTML と CSP | `media-src` を追加する |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/Webview.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/Webview.ts.yaml) | パネルの中のスクリプト。相対パスの画像を Webview の URI に替える | 動画・音声・ポスターも替える |
| ドキュメント | [dev/設計書/設定/VSCode拡張機能.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E8%A8%AD%E5%AE%9A/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD.yaml) | 拡張機能が読む `mdmark.config.yaml` のキー | アセットのルートを追加する |
| 実装 | [vscode/src/preview/html.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/preview/html.ts) | CSP は `img-src` だけを持ち、`media-src` が無い | `media-src` を追加する |
| 実装 | [vscode/src/webview/preview.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/webview/preview.ts) | 相対パスの `img` を Webview の URI に替える | `video`・`audio`・`source`・`poster` とアセットのルートを当てる |

<!-- /table -->

## 変更方針

<!-- table: data -->

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| CSP | `media-src` に `cspSource` と `https:` を足す | |
| 相対パスの動画・音声 | 相対パスの `video`・`audio`・`source` の `src` と `poster` を、`img` と同じく Webview の URI に替える。文書からの相対パスで見つからないときはアセットのルートで探す | |
| 既存機能への影響 | 相対パスの画像・リンクの開き方を保つ | |

<!-- /table -->

## テスト結果

なし
