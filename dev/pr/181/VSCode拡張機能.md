# VSCode拡張機能

## 現状

<!-- table: data -->

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| 実装 | [vscode/package.json](https://github.com/shuhei1101/mdmark/blob/develop/vscode/package.json) | コマンド・メニュー・設定（`mdmark.preview.theme` など） | 設定を開くコマンド・歯車のボタン・テーマの設定を追加する |
| 実装 | [vscode/src/extension.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/extension.ts) | コマンドの登録 | 設定を開くコマンドを登録する |
| 実装 | [vscode/src/settings.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/settings.ts) | `settings.json` の `mdmark.*` の取り出し | テーマの設定を取り出す |
| 実装 | [vscode/src/config.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/config.ts) | `mdmark.config.yaml` から `features`・`libraries` を取り出す | テーマを選ぶキーを取り出す |
| 実装 | [vscode/src/messages.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/messages.ts) | Webview とのメッセージの型 | テーマを送る |
| 実装 | [vscode/src/preview/manager.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/preview/manager.ts) | 設定の変更を受けてパネルに送り直す | テーマの設定の変更を受ける |
| 実装 | [vscode/src/webview/preview.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/webview/preview.ts) | パネルの中で明暗の class を付ける | 選んだテーマを当てる |
| 実装 | [vscode/src/export/html.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/export/html.ts) | 書き出す HTML | 選んだテーマを当てる |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/プレビューをVSCodeのテーマに合わせる.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92VSCode%E3%81%AE%E3%83%86%E3%83%BC%E3%83%9E%E3%81%AB%E5%90%88%E3%82%8F%E3%81%9B%E3%82%8B.yaml) | プレビューの明暗のシナリオ | 選んだテーマとの組み合わせを追加する |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/VSCodeでプレビューを開く.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/VSCode%E3%81%A7%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E9%96%8B%E3%81%8F.yaml) | プレビューを開くシナリオ | 実行のみ |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/HTMLに書き出す.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/HTML%E3%81%AB%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%99.yaml) | VS Code の HTML の書き出しのシナリオ | 選んだテーマが当たることを追加する |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/PDFに印刷する.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/PDF%E3%81%AB%E5%8D%B0%E5%88%B7%E3%81%99%E3%82%8B.yaml) | VS Code の PDF の印刷のシナリオ | 印刷の配色に追従する |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/プレビューを開く.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E9%96%8B%E3%81%8F.ts.yaml) | プレビューを開くコマンド | テーマを送るフローを追加する |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/プレビューを描き直す.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E6%8F%8F%E3%81%8D%E7%9B%B4%E3%81%99.ts.yaml) | 設定の変更での描き直し | テーマの設定の変更を追加する |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/設定ファイルを開く.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E8%A8%AD%E5%AE%9A%E3%83%95%E3%82%A1%E3%82%A4%E3%83%AB%E3%82%92%E9%96%8B%E3%81%8F.ts.yaml) | `mdmark.openConfig` | 設定を開くコマンドとの違いを分ける |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/HTMLに書き出す.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/HTML%E3%81%AB%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%99.ts.yaml) | `mdmark.exportHtml` | 選んだテーマを当てるフローを追加する |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/拡張機能の入口.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD%E3%81%AE%E5%85%A5%E5%8F%A3.ts.yaml) | `activate` と `contributes` | 設定を開くコマンドとボタンを追加する |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/設定.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E8%A8%AD%E5%AE%9A.ts.yaml) | `settings.json` と `mdmark.config.yaml` の取り出し | テーマの設定を追加する |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/プレビュー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC.ts.yaml) | パネルの管理・描き直し | テーマの変更の送り直しを追加する |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/Webview.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/Webview.ts.yaml) | パネルの中のスクリプト・メッセージの型 | テーマを当てる処理を追加する |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/書き出し.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%97.ts.yaml) | HTML への書き出し | 選んだテーマを当てる |
| ドキュメント | [dev/設計書/設定/VSCode拡張機能.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E8%A8%AD%E5%AE%9A/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD.yaml) | `settings.json` の `mdmark.*` | テーマの設定を追加する |
| ドキュメント | [dev/設計書/画面設計/VSCodeのプレビュー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E7%94%BB%E9%9D%A2%E8%A8%AD%E8%A8%88/VSCode%E3%81%AE%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC.ts.yaml) | プレビューのパネル | 選んだテーマの当て方を追加する |
| ドキュメント | [dev/設計書/画面設計/VSCodeのコマンドと通知.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E7%94%BB%E9%9D%A2%E8%A8%AD%E8%A8%88/VSCode%E3%81%AE%E3%82%B3%E3%83%9E%E3%83%B3%E3%83%89%E3%81%A8%E9%80%9A%E7%9F%A5.ts.yaml) | エディタのボタン・コマンドの表示名 | 設定を開くコマンドと歯車のボタンを追加する |

<!-- /table -->

## 変更方針

<!-- table: data -->

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 設定を開くコマンド | コマンドパレットに mdmark の設定を開くコマンドを追加し、VS Code の設定画面を mdmark の項目に絞って開く | 既存の `mdmark.openConfig`（YAML の設定ファイル）は残す |
| 歯車のボタン | エディタのタイトルバー（`editor/title`）にプレビューのときだけ歯車のボタンを出し、設定を開くコマンドを呼ぶ | - |
| テーマの設定 | プレビューで使うテーマを `mdmark.colorTheme`（設定画面の表示は「Mdmark: Color Theme」、値が空の選択肢は「（設定ファイルに従う）」）で選べるようにする。明暗の `mdmark.preview.theme`（`auto` / `light` / `dark`）は今のまま残す | VS Code の設定が `mdmark.config.yaml` に勝ち、VS Code の設定が空のときは設定ファイルに従う（[要件](./要件.md)） |
| 描き直し | テーマの設定と設定ファイルのテーマのキーが変わったら、リロードせずにプレビューを描き直す | 今の `mdmark.preview.theme` の変更と同じ経路 |
| 書き出し | HTML への書き出し・PDF への印刷も、選んだテーマで描く | - |
| 既存機能への影響 | 既存の設定とコマンドの名前・値は変えない | - |
| アクセシビリティ | 歯車のボタンは読み上げ名とツールチップに「設定を開く」を持たせ、キーボードで押せる | - |

<!-- /table -->

## テスト結果

### 単体

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| [tests/unit/vscode/src/settings.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/vscode/src/settings.test.ts) | 全実行 | 変更 | ✅ | `test_read_settings_when_color_theme` を追加<br>`テスト結果/20261030044045_85e021b_単体テスト.log` |
| [tests/unit/vscode/src/config.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/vscode/src/config.test.ts) | 全実行 | 変更 | ✅ | `test_parse_config_when_color_theme`・`test_apply_color_theme` を追加<br>`テスト結果/20261030044045_85e021b_単体テスト.log` |
| 上記以外の単体テスト | 全実行 | 実行のみ | ✅ | VS Code 拡張機能の残りの単体テスト<br>`テスト結果/20261030044045_85e021b_単体テスト.log` |

全体は 155 ファイル・1100 テストが pass。lint（Biome の check と tsc の型検査）は違反 0 件で、ログは `テスト結果/20261030044045_85e021b_lint.log`。

### 結合

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| `vscode/tests/integration/open-settings.test.ts` | 全実行 | 新規 | ✅ | `test_normal`・`test_normal_when_command_palette`<br>`テスト結果/20261030053626_9b47953_結合テスト.log` |
| [vscode/tests/integration/commands.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/commands.test.ts) | `test_normal_when_command_titles`・`test_normal_when_editor_title_button`・`test_normal_when_command_palette_conditions`・`test_normal_when_settings_button` | 変更 | ✅ | 設定を開くコマンドと歯車のボタンの分を期待値に足し、`test_normal_when_settings_button` を追加<br>`テスト結果/20261030053626_9b47953_結合テスト.log` |
| [vscode/tests/integration/preview-rerender.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/preview-rerender.test.ts) | `test_normal_when_color_theme_changed` | 変更 | ✅ | 1 テストを追加<br>`テスト結果/20261030053626_9b47953_結合テスト.log` |
| [vscode/tests/integration/export.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/export.test.ts) | `test_normal_when_color_theme_selected`（HTML に書き出す・PDF に印刷の各 1 件） | 変更 | ✅ | 2 テストを追加<br>`テスト結果/20261030053626_9b47953_結合テスト.log` |
| [vscode/tests/integration/helpers.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/helpers.ts) | - | 変更 | ✅ | `resetEnvironment` が `colorTheme` の設定も戻す<br>`テスト結果/20261030053626_9b47953_結合テスト.log` |
| [vscode/tests/integration/preview-open.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/preview-open.test.ts) | `test_normal_when_tags_unreachable` | 実行のみ | ❌ | 要求まで 1734 ms（期待は 2800 ms 以上）。変更前の develop（a6abcb1）でも同じ値で落ちる既存の失敗<br>`テスト結果/20261030053626_9b47953_結合テスト.log` |
| 上記以外の `vscode/tests/integration/` | 全実行 | 実行のみ | ✅ | 57 テスト中 56 が pass（VS Code 1.141.0 と stable の両方）<br>`テスト結果/20261030053626_9b47953_結合テスト.log` |
