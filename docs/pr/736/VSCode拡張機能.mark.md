# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/scenario/SC-472-6.yaml](https://github.com/shuhei1101/mdmark/blob/05f6f940b52a7e105fce45380c866ea71e1e2faf/docs/scenario/SC-472-6.yaml) | HTML に書き出す | ページのタイトルにフロントマターの `title` を加える |
| ドキュメント | [docs/interface/IF-472-15.ts.yaml](https://github.com/shuhei1101/mdmark/blob/05f6f940b52a7e105fce45380c866ea71e1e2faf/docs/interface/IF-472-15.ts.yaml) | HTML に書き出す（コマンド） | ページのタイトルの決め方 |
| ドキュメント | [docs/module/MOD-472-99.ts.yaml](https://github.com/shuhei1101/mdmark/blob/05f6f940b52a7e105fce45380c866ea71e1e2faf/docs/module/MOD-472-99.ts.yaml) | 書き出し / export.ts | ページのタイトル |
| 実装 | [vscode/src/export/export.ts](https://github.com/shuhei1101/mdmark/blob/05f6f940b52a7e105fce45380c866ea71e1e2faf/vscode/src/export/export.ts) | HTML への書き出し・ブラウザで開く・PDF への印刷 | ページのタイトルがファイル名 |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 書き出した HTML のページのタイトル | 文書の先頭のフロントマターの `title` を使用し、無ければ今と同じファイル名にする | 拡張機能の書き出しは索引を読まない |
| プレビュー | プレビューのタブの名前は変えない | - |
