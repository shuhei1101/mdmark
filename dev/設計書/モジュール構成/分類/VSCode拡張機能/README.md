# VSCode拡張機能

VSCode拡張機能 の設計書

## 目次

<!-- table: data -->

| ページ | 概要 |
| --- | --- |
| [Webview](./Webview.yaml) | プレビューのパネルの中で動く React の画面と、配布物を読み込む前にも出す部品。jsDelivr の mdmark を読み込んで `mount`・`update` で描き、スクロール・リンク・状態の表示を担う。拡張機能とのメッセージの型も持つ。 |
| [ビルドと配布](./ビルドと配布.yaml) | 拡張機能を esbuild、Webview を Vite で書き出し、タグとバージョンを照合して .vsix を GitHub Release に添える。拡張機能ホストで実行する結合テストの起動も持つ。配布物には入らない。 |
| [プレビュー](./プレビュー.yaml) | Markdown ごとのプレビューのパネルを開き、Webview の HTML・CSP を組み、再描画し・スクロールの同期・リンクの振り分けを担う拡張機能の側の処理。 |
| [拡張機能の入口](./拡張機能の入口.yaml) | 拡張機能の `activate` と、`vscode/package.json` の `contributes`（コマンド・ショートカット・メニュー・設定）。コマンドと VS Code の通知を各機能へつなぐ。 |
| [書き出し](./書き出し.yaml) | 開いている Markdown を jsDelivr の配布物で描く 1 つの HTML に書き出し、ブラウザで開き、印刷のダイアログを出させる。 |
| [設定](./設定.yaml) | VS Code の設定 `mdmark.*` の読み取りと、`mdmark.config.yaml` の場所の解決・端末の設定と重ねた設定の読み取り・`mount` に指定するキーの取り出し・雛形の作成。 |

<!-- /table -->
