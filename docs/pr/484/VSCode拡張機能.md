# VSCode拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/scenario/SC-472-10.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/scenario/SC-472-10.yaml) | VSCodeでプレビューを開く | 相対パスの `syntax.url` で色分けするシナリオを追加 |
| ドキュメント | [docs/scenario/SC-472-6.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/scenario/SC-472-6.yaml) | HTMLに書き出す | 相対パスの `syntax.url` を埋めるシナリオを追加 |
| ドキュメント | [docs/interface/IF-472-21.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-21.ts.yaml) | プレビューを再描画する（制約「設定の取り出し方」・相対パスの解決と CSP の origin の再読み込み） | 取り出すキーに `tooltips`・`syntax` を、相対パスを解決する値に `syntax.url` を追加 |
| ドキュメント | [docs/interface/IF-472-22.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-22.ts.yaml) | プレビューを開く（CSP・`render` の `config` の形） | `syntax.url` の origin と `config` の `tooltips`・`syntax` を追加 |
| ドキュメント | [docs/interface/IF-472-15.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-15.ts.yaml) | HTMLに書き出す（制約「埋めるライブラリ」） | 相対パスの `syntax.url` の埋め方を追加 |
| ドキュメント | [docs/interface/IF-472-18.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-18.ts.yaml) / [docs/interface/IF-472-16.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-16.ts.yaml) | ブラウザで開く・PDFに印刷する | HTMLに書き出すと同じ `config` で書き出す。記述の追随を確かめる |
| ドキュメント | [docs/module/MOD-472-104.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-104.ts.yaml) | 設定 / config.ts（`PreviewConfig`・`pickPreviewConfig`・`libraryOrigins`・`resolveMermaid`） | `tooltips`・`syntax` の取り出しと `syntax.url` の解決・origin を追加 |
| ドキュメント | [docs/module/MOD-472-90.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-90.ts.yaml) / [docs/module/MOD-472-92.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-92.ts.yaml) | プレビュー / panel.ts・html.ts | 相対パスの `syntax.url` の解決と CSP の origin を追加 |
| ドキュメント | [docs/module/MOD-472-99.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-99.ts.yaml) / [docs/module/MOD-472-102.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-102.ts.yaml) | 書き出し / export.ts・embed.ts | 相対パスの `syntax.url` を埋める |
| 実装 | [vscode/src/config.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/config.ts) | `pickPreviewConfig`・`libraryOrigins`・`resolveHtmlScripts`・`resolveMermaid` | `tooltips`・`syntax` を追加 |
| 実装 | [vscode/src/preview/panel.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/preview/panel.ts) / [vscode/src/preview/html.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/preview/html.ts) | `render` の `config` と CSP | `syntax.url` の解決と origin を追加 |
| 実装 | [vscode/src/export/export.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/export/export.ts) / [vscode/src/export/embed.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/export/embed.ts) | 書き出す HTML の `config` と相対パスの値の埋め方 | 相対パスの `syntax.url` を埋める |
| テスト | [tests/unit/vscode/src/config.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/vscode/src/config.test.ts) / [tests/unit/vscode/src/export/embed.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/vscode/src/export/embed.test.ts) | 設定の取り出し・埋め方の単体テスト | ケースを追加 |
| テスト | [vscode/tests/integration/preview-open.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/preview-open.test.ts) / [vscode/tests/integration/export.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/export.test.ts) | プレビューと書き出しの結合テスト | ケースを追加 |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| `PreviewConfig`・`pickPreviewConfig` | 重ねた設定の `tooltips`・`syntax` がマップのときだけ取り出す。マップでないときは指定しない | `labels` と同じ扱い |
| `tooltips` | 記載した値のまま `mount` に指定する | 相対パスの解決は要らない |
| CSP | `syntax.url`（記載しないときは既定の jsDelivr）の `http:`・`https:` の origin を `script-src` に追加する。再読み込みで origin の集まりが変わったら Webview の HTML を入れ直す | `mermaid.url` と同じ扱い |
| プレビューの相対パスの `syntax.url` | 設定ファイルのフォルダから解決したフォルダを Webview の URL にし、末尾の `/` を残す | `localResourceRoots` の外は Webview が読み込めず、色分けせずに描く |
| 書き出しの相対パスの `syntax.url` | 文書が使用する言語があるときだけ、本体と言語のモジュールを HTML に埋める | 埋め方は [要件](./要件.md) の `未確定` |
| 単体テスト | `tooltips`・`syntax` の取り出し・`syntax.url` の解決と origin・埋め方のケースを追加する | - |
| 結合テスト | プレビューと書き出した HTML で、`tooltips.placement` の位置と相対パスの `syntax.url` の色分けを確かめる | 不具合は拡張機能の画面で効かないことなので、描いた結果で確かめる |

## テスト結果

なし
