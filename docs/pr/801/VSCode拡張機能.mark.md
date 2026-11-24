# VS Code 拡張機能

## 現状

<!-- table: {"kind": "data"} -->

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/scenario/SC-472-31.yaml](https://github.com/shuhei1101/mdmark/blob/de9f7a458626b27d09ae0546a7f6c916cc4797d0/docs/scenario/SC-472-31.yaml) | 単一 UC『プレビューのリンクと画像を開く』 | モーダルで再生する相対パスの動画のシナリオを追加する |
| ドキュメント | [docs/module/MOD-472-70.ts.yaml](https://github.com/shuhei1101/mdmark/blob/de9f7a458626b27d09ae0546a7f6c916cc4797d0/docs/module/MOD-472-70.ts.yaml) | モジュール構成『Webview / panel/assets.ts』 | 動画の相対パスの読み替えと再生できない動画の通知 |
| 実装 | [vscode/src/webview/features/preview/panel/assets.ts](https://github.com/shuhei1101/mdmark/blob/de9f7a458626b27d09ae0546a7f6c916cc4797d0/vscode/src/webview/features/preview/panel/assets.ts) | `img[src]`・`video[src]`・`video[poster]`・`audio[src]` の相対パスを Webview で参照できる URL に替え、再生できない動画を通知ブロックに替える | モーダルで開くまで `video` が無い動画の `src` を、描いた時点で読み替えられるか確認する |
| 実装 | [vscode/src/preview/assets.ts](https://github.com/shuhei1101/mdmark/blob/de9f7a458626b27d09ae0546a7f6c916cc4797d0/vscode/src/preview/assets.ts) | プレビューが参照するファイルの許可 | - |

<!-- /table -->

## 変更方針

<!-- table: {"kind": "data"} -->

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 相対パスの読み替え | その場に出すものが持つ動画・音声・`poster` のパスも読み替え、モーダルで開いた動画を再生できるようにする | ライブラリ本体の HTML を決定してから決める |
| 再生できない動画 | モーダルの中の動画が再生できないとき、モーダルの中に今と同じ通知ブロックを出す | - |

<!-- /table -->

## テスト結果

なし
