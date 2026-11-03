# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/VSCodeでプレビューを開く.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/VSCode%E3%81%A7%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E9%96%8B%E3%81%8F.yaml) | プレビューを開いて描く | 取り込む文書を渡す |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/プレビューを描き直す.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E6%8F%8F%E3%81%8D%E7%9B%B4%E3%81%99.ts.yaml) | 書き換えで描き直す | 取り込む文書の書き換えでも描き直すか |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/プレビュー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC.ts.yaml) | パネルと描き直し | 取り込む文書の読み取り |
| 実装 | [vscode/src/preview/panel.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/preview/panel.ts) | プレビューのパネル | 取り込む文書を読んで mount に渡す |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 取り込む文書 | 開いている Markdown からの相対パスでワークスペースのファイルを読み、取り込む文書の表を渡す | `未確定`（要件.md）。案 B に決まった場合はこの計画書を削除する |

## テスト結果

なし
