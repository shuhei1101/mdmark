# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/設定/VSCode拡張機能.yaml](https://github.com/shuhei1101/mdmark/blob/6e8cbadde9601e96f85885ca0fdad0fdb1d84281/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E8%A8%AD%E5%AE%9A/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD.yaml) | 拡張機能の設定と、拡張機能が読み込む設定ファイルのキー | `features` はそのまま `mount` に指定する |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/記載した内容をプレビューに映す.yaml](https://github.com/shuhei1101/mdmark/blob/6e8cbadde9601e96f85885ca0fdad0fdb1d84281/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E8%A8%98%E8%BC%89%E3%81%97%E3%81%9F%E5%86%85%E5%AE%B9%E3%82%92%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%81%AB%E6%98%A0%E3%81%99.yaml) | Markdown の書き換えをプレビューに映す | フロントマターを持つ文書を確かめる |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/エディタとプレビューのスクロールを合わせる.yaml](https://github.com/shuhei1101/mdmark/blob/6e8cbadde9601e96f85885ca0fdad0fdb1d84281/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E3%82%A8%E3%83%87%E3%82%A3%E3%82%BF%E3%81%A8%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%81%AE%E3%82%B9%E3%82%AF%E3%83%AD%E3%83%BC%E3%83%AB%E3%82%92%E5%90%88%E3%82%8F%E3%81%9B%E3%82%8B.yaml) | 元の行番号でスクロールを合わせる | 実行のみ |
| 実装 | [vscode/src/config.ts](https://github.com/shuhei1101/mdmark/blob/6e8cbadde9601e96f85885ca0fdad0fdb1d84281/vscode/src/config.ts) | 重ねた設定から `mount` に指定するキーを取り出す | `features` をそのまま指定するため変更しない |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 切り替え | `mdmark.config.yaml` と端末の設定の `features.frontmatter` を、今と同じく `features` として `mount` に指定する | `settings.json` にキーを追加するかは `未確定`（[要件](./要件.md)） |
| スクロールの同期 | フロントマターを除外した文書でも、元の行番号でエディタとプレビューのスクロールを合わせる | フロントマターの範囲のエディタの行は、本文の先頭に合わせる |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 単一ユースケース設計 | `6e8cbadd..10c77c74` | - |
| 単一ユースケース設計 | `10c77c74..f51eca32` | レビューの指摘の修正 |

## テスト結果

未実施
