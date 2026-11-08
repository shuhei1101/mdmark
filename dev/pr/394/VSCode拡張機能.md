# VS Code 拡張機能

## 現状

<!-- table: data -->

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/](https://github.com/shuhei1101/mdmark/tree/7a9367dd/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD) | コマンドとメッセージ | 文の単語の修正。`プレビューを描き直す` の改名 |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/](https://github.com/shuhei1101/mdmark/tree/7a9367dd/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD) | モジュールの構成 | 文の単語の修正。`読むバージョン` の改名 |
| ドキュメント | [dev/設計書/画面設計/VSCodeのコマンドと通知.ts.yaml](https://github.com/shuhei1101/mdmark/blob/7a9367dd/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E7%94%BB%E9%9D%A2%E8%A8%AD%E8%A8%88/VSCode%E3%81%AE%E3%82%B3%E3%83%9E%E3%83%B3%E3%83%89%E3%81%A8%E9%80%9A%E7%9F%A5.ts.yaml) | コマンドの表示名・ダイアログ・通知の文言 | 表示の文言の修正 |
| ドキュメント | [dev/設計書/設定/VSCode拡張機能.yaml](https://github.com/shuhei1101/mdmark/blob/7a9367dd/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E8%A8%AD%E5%AE%9A/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD.yaml) | `settings.json` の `mdmark.*` の説明 | 説明の単語の修正（キーは変えない） |
| 実装 | [vscode/](https://github.com/shuhei1101/mdmark/tree/7a9367dd/vscode) | 拡張機能の入口・プレビュー・Webview・`package.json` | コメントと、コマンドの表示名・通知・設定の説明の修正 |
| テスト | [vscode/tests/](https://github.com/shuhei1101/mdmark/tree/7a9367dd/vscode/tests) | 拡張機能の単体・結合テスト | コメント・テストの名前・文言の期待値の修正 |

<!-- /table -->

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 単語の置き換え | [ライブラリ本体](./ライブラリ本体.md) と同じ決まりで置き換える | - |
| コマンドの表示名と通知 | `package.json` の `title`・`description` と通知の文言を、規約『入力と文言』の書式にする | コマンドの ID と設定のキーは変えない |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| インターフェース定義設計 | [7a9367dd..8d8ca21e](https://github.com/shuhei1101/mdmark/compare/7a9367dd...8d8ca21e) | ファイル名と参照の改名はドキュメント修正で行う |

## テスト結果

未実施。
