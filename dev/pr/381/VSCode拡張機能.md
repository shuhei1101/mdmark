# VSCode拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [設計書/モジュール構成/VSCode拡張機能/設定.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E8%A8%AD%E5%AE%9A.ts.yaml) | `PreviewConfig` と設定ファイルを読む処理 | 取り出すキーに `labels` を追加 |
| ドキュメント | [設計書/インターフェース定義/VSCode拡張機能/プレビューを描き直す.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E6%8F%8F%E3%81%8D%E7%9B%B4%E3%81%99.ts.yaml) | 制約「設定の取り出し方」 | 取り出すキーに `labels` を追加 |
| ドキュメント | [設計書/インターフェース定義/VSCode拡張機能/プレビューを開く.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E9%96%8B%E3%81%8F.ts.yaml) | 制約「メッセージ」の `render` の `config` の形 | `labels` を追加 |
| ドキュメント | [設計書/インターフェース定義/VSCode拡張機能/HTMLに書き出す.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/HTML%E3%81%AB%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%99.ts.yaml) | `config` はプレビューを描き直す.ts の制約「設定の取り出し方」と同じ | 記述は変わらず、追随を確かめる |
| 実装 | [vscode/src/config.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/config.ts) | `PreviewConfig`・`pickPreviewConfig` | `labels` を追加 |
| 実装 | [vscode/src/preview/panel.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/preview/panel.ts) / [vscode/src/export/export.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/export/export.ts) | 取り出した `config` を `render` と書き出す HTML へ渡す | 変更なし（`config` をそのまま渡す） |
| テスト | [tests/unit/vscode/src/config.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/vscode/src/config.test.ts) | 設定ファイルを読む処理の単体テスト | `labels` の取り出しのケースを追加 |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| `PreviewConfig` | `labels?: Record<string, unknown>`（記載した値のまま。中の知らないキーと型の違う値は mdmark が無視する）を追加 | `side-toc` と同じ扱い |
| `pickPreviewConfig` | 重ねた設定の `labels` がマップのときだけ `picked.labels` に入れる。マップでないときは渡さない | 相対パスの解決は要らない |
| プレビュー | `render` の `config` に `labels` が入る。`config` が変わったときは今までどおり `mount` し直す | 実装の変更なし |
| 書き出し（HTML に書き出す・ブラウザで開く・PDF に印刷） | 書き出す HTML の `config` に `labels` が入る | 実装の変更なし |
| 単体テスト | `labels` がマップのとき取り出し、マップでないとき・書かないとき取り出さないケースを追加 | - |
| 結合テスト | プレビューと書き出した HTML で、`labels.paramCopy` の文言のボタンが描かれることを確かめるケースを追加する | `未確定`（決める段: インターフェース定義設計） |

| 案 | 内容 |
| --- | --- |
| A | インターフェース定義『プレビューを開く』と『HTMLに書き出す』にケースを足し、結合テストで確かめる |
| B | 単体テストだけで確かめる（`config` をそのまま渡す経路は既存の結合テストが確かめている） |

推奨: A

不具合は「設定に書いても拡張機能の画面で効かない」ことなので、描いたボタンの文言で確かめるほうが再発を見つけられるため。

## テスト結果

なし
