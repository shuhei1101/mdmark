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
| インターフェース定義設計 | [f828e525..05587ca2](https://github.com/shuhei1101/mdmark/compare/f828e525...05587ca2) | レビューの指摘の修正 |
| インターフェース定義設計 | [2a8e6a4e..55ada24b](https://github.com/shuhei1101/mdmark/compare/2a8e6a4e...55ada24b) | レビューの指摘の修正（外す・写し） |
| インターフェース定義設計 | [56f4a0d0..0d39c874](https://github.com/shuhei1101/mdmark/compare/56f4a0d0...0d39c874) | レビューの指摘の修正（状態と受け取りの外す） |
| 部品設計 | [600ebd3e..c1a3c48f](https://github.com/shuhei1101/mdmark/compare/600ebd3e...c1a3c48f) | 部品設計と画面設計を同じ commit で確定。インターフェース定義の任意の指摘も含む |
| 画面設計 | [600ebd3e..c1a3c48f](https://github.com/shuhei1101/mdmark/compare/600ebd3e...c1a3c48f) | - |
| 部品設計・画面設計 | [6d3fb522..4e251afc](https://github.com/shuhei1101/mdmark/compare/6d3fb522...4e251afc) | レビューの指摘の修正（バッククォート内の文言はインターフェース定義も同じ commit で修正） |
| 部品設計・画面設計 | [06d3bce2..5637b731](https://github.com/shuhei1101/mdmark/compare/06d3bce2...5637b731) | レビューの指摘の修正（読み込みと保存の関数） |

## テスト結果

### ドキュメント修正

ドキュメント修正の工程は文書と設計書の単語・ファイル名だけを変え、実装コードを変えていないため、関係する単体・結合テストは無い。E2E のテストファイルは、改名したシナリオの対応テストファイルに合わせて改名だけをした（中身は E2E テスト作成の工程で修正する）。
