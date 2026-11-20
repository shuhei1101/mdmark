# VS Code 拡張機能

## 書き出した HTML に元の Markdown を埋め込まない（#769）

### 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/scenario/SC-472-6.yaml](https://github.com/shuhei1101/mdmark/blob/133b1da5/docs/scenario/SC-472-6.yaml) | HTMLに書き出す | 書き出した HTML を開いたときの流れを、描いた HTML から起動する流れに変える |
| ドキュメント | [docs/scenario/SC-472-9.yaml](https://github.com/shuhei1101/mdmark/blob/133b1da5/docs/scenario/SC-472-9.yaml) | PDFに印刷する | SC-472-6 に追随する |
| ドキュメント | [docs/interface/IF-472-15.ts.yaml](https://github.com/shuhei1101/mdmark/blob/133b1da5/docs/interface/IF-472-15.ts.yaml) | HTMLに書き出す | 制約「書き出す中身」が `TextDocument.getText()` の全文を `<script type="application/json">` に埋め、`mount(..., { markdown, config })` で描く |
| ドキュメント | [docs/interface/IF-472-16.ts.yaml](https://github.com/shuhei1101/mdmark/blob/133b1da5/docs/interface/IF-472-16.ts.yaml) | PDFに印刷する | IF-472-15 と同じ組み立てを使う |
| ドキュメント | [docs/interface/IF-472-18.ts.yaml](https://github.com/shuhei1101/mdmark/blob/133b1da5/docs/interface/IF-472-18.ts.yaml) | ブラウザで開く | 同上 |
| ドキュメント | [docs/module/MOD-472-99.ts.yaml](https://github.com/shuhei1101/mdmark/blob/133b1da5/docs/module/MOD-472-99.ts.yaml) | export.ts | `document.getText()` を組み立てへ渡す |
| ドキュメント | [docs/module/MOD-472-100.ts.yaml](https://github.com/shuhei1101/mdmark/blob/133b1da5/docs/module/MOD-472-100.ts.yaml) | html.ts | `buildExportHtml` が本文と設定の JSON と `mount` を呼ぶスクリプトを組む |
| ドキュメント | [docs/module/MOD-472-102.ts.yaml](https://github.com/shuhei1101/mdmark/blob/133b1da5/docs/module/MOD-472-102.ts.yaml) | embed.ts | 相対パスのライブラリと範囲のスクリプトを埋める（描いた HTML でも要るかを確認する） |
| ドキュメント | [docs/interface/IF-472-35.ts.yaml](https://github.com/shuhei1101/mdmark/blob/133b1da5/docs/interface/IF-472-35.ts.yaml) | 文書を描く | `opts.rendered`・`opts.pureMarkdown`（#753 で追加）。変更は無い見込み |
| ドキュメント | [docs/screen/SCR-472-1.ts.yaml](https://github.com/shuhei1101/mdmark/blob/133b1da5/docs/screen/SCR-472-1.ts.yaml) | VS Code のコマンドと通知 | 配布物を取得できないとき・描いた HTML から起動できないバージョンのときの通知を追加する |
| 実装 | [vscode/src/export/export.ts](https://github.com/shuhei1101/mdmark/blob/133b1da5/vscode/src/export/export.ts) | 書き出し・ブラウザで開く・印刷のコマンド | - |
| 実装 | [vscode/src/export/html.ts](https://github.com/shuhei1101/mdmark/blob/133b1da5/vscode/src/export/html.ts) | 書き出す HTML の組み立て | `data.markdown` を `mount` に指定する |
| 実装 | [vscode/tests/integration/export.test.ts](https://github.com/shuhei1101/mdmark/blob/133b1da5/vscode/tests/integration/export.test.ts) | 書き出しの結合テスト | 埋めた JSON の中身の確認を変える |

### 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 描く処理の在りか | 書き出すときに、設定のバージョンの配布物で `render`・`toPureMarkdown` を呼んで描く | 取得した `dist/index.js` はバージョンごとに拡張機能の保存先に置く（[要件](./要件.mark.md) の #769） |
| 書き出す中身 | 埋める JSON から `markdown` を削除し、描いた結果（本文の HTML・機能のオン・オフ・ページの設定）と純粋な Markdown を持たせる | CLI の `ExportPayload`（#753）と同じ持ち方に揃える |
| 開いたときの起動 | `mount(main, { rendered, pureMarkdown, config, aliases })` で描き、外部ライブラリ・拡張のマーカーは残したマーカーの場所にモジュールで描く | 印刷を待つ処理は今のまま |
| 取り込み | 取り込む文書の本文は描いた HTML に入れ、Markdown を埋めない | - |
| 通知 | 配布物を取得できないとき・`opts.rendered` を持たないバージョンのときに書き出さず通知を出す | 文言は画面設計（SCR-472-1） |
| 確認 | 書き出した HTML に元の Markdown の文字列（マーカー・生の HTML）が含まれないことと、開いて描き終えた本文が今と同じであることを結合テストで確認する | - |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 単一ユースケース設計 | `133b1da5..fe3b8046` | - |
| 単一ユースケース設計 | `fe3b8046..f7f72394` | レビューの指摘の修正 |
| インターフェース定義設計 | `9e0a8e97..aad634c7` | - |
| インターフェース定義設計 | `ebd2244d..57b60672` | レビューの指摘の修正 |
| 画面設計 | `9a1d8815..f16e2411` | - |
| 画面設計 | `ee052719..b165a4bc` | レビューの指摘の修正 |
| モジュール構成設計 | `e009287c..eafe9d89` | - |
