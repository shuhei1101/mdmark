# VSCode拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/プレビューを開く.ts.yaml](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E9%96%8B%E3%81%8F.ts.yaml) | プレビューを開くコマンドの入出力・制約・フロー | 更新対象。制約「差分ビューの判定」の補足、例外「なし（Markdown でない）」の補足、`test_error_when_not_markdown` のフローの期待値が `editorLangId == markdown` を前提にしている |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/拡張機能の入口.ts.yaml](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD%E3%81%AE%E5%85%A5%E5%8F%A3.ts.yaml) | activate と package.json の contributes | 更新対象。`menus` の `editor/title` と `keybindings` の `when` |
| ドキュメント | [dev/設計書/画面設計/VSCodeのコマンドと通知.ts.yaml](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E7%94%BB%E9%9D%A2%E8%A8%AD%E8%A8%88/VSCode%E3%81%AE%E3%82%B3%E3%83%9E%E3%83%B3%E3%83%89%E3%81%A8%E9%80%9A%E7%9F%A5.ts.yaml) | エディタのボタン・コマンドの表示名 | 更新対象。「プレビューを横に開くボタン」の表示条件 |
| 実装 | [vscode/package.json](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/vscode/package.json) | 拡張機能の contributes | `menus` の `editor/title` の `mdmark.openPreviewToSide`（`:82`）と `keybindings` の `shift+alt+d`（`:129`）の `when` が `editorLangId == markdown` |
| テスト | [vscode/tests/integration/commands.test.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/vscode/tests/integration/commands.test.ts) | contributes の結合テスト | `test_normal_when_editor_title_button` が `when` の値をそのまま比べている |
| テスト | [vscode/tests/integration/preview-open.test.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/vscode/tests/integration/preview-open.test.ts) | プレビューを開くの結合テスト | `test_error_when_not_markdown` が `when` に `editorLangId == markdown` があることを確かめている |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| ショートカットとボタンの `when` | `keybindings` の `shift+alt+d` と `menus` の `editor/title` の `mdmark.openPreviewToSide` の `when` を、VS Code 1.141.0 の差分エディターの両側でも当たり、Markdown でないエディタでは当たらない条件にする | `未確定`（要件.md の `## 要望`。決める段: PoC 検証） |
| 差分ビューの判定 | コマンドを呼んだ後の判定（`TabInputTextDiff` と両側の `languageId`）は変えない。制約の補足の「`editorLangId == markdown` のまま差分ビューの両側に出る」を、決めた条件へ書き換える | - |
| Markdown でないときの扱い | Markdown でないエディタではショートカットとボタンを出さないまま保つ。`test_error_when_not_markdown` の期待値を決めた条件に合わせる | - |
| 既存機能への影響 | 普通の Markdown のエディタでショートカットとボタンが今のとおり効くことを、結合テストと E2E『VSCodeでプレビューを開く』で確かめる | - |
| 対応する VS Code の版 | `engines.vscode` の下限は変えない。決めた条件の context key が下限のバージョンにもあることを PoC で確かめる | - |

## テスト結果
