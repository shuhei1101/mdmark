# VSCode拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| テスト | [tests/e2e/vscode.ts](https://github.com/shuhei1101/mdmark/blob/9721d513c1d6b4f0486daf29f9d43e4b69abf7b3/tests/e2e/vscode.ts) | VS Code 拡張機能の E2E の準備と共通の処理 | `buildExtensionAndDist`（`:58`）が `vscode/` だけを複製し、`node_modules` だけをリンクする。複製の先に直下の `src/` が無い |
| テスト | [tests/unit/vscode/scripts/build.test.ts](https://github.com/shuhei1101/mdmark/blob/9721d513c1d6b4f0486daf29f9d43e4b69abf7b3/tests/unit/vscode/scripts/build.test.ts) | 拡張機能のビルドの単体テスト | `copyExtension` が一時フォルダの直下に `src`・`schemas`・`node_modules` のリンクを作って対応済み |
| 実装 | [vscode/src/extension.ts](https://github.com/shuhei1101/mdmark/blob/9721d513c1d6b4f0486daf29f9d43e4b69abf7b3/vscode/src/extension.ts) ほか `vscode/src/` の 6 ファイル | 拡張機能のソース | `../../src/config-files.ts` か `../../src/bundle-module.ts` を import する |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| `buildExtensionAndDist` | 複製の後、一時フォルダの直下に、リポジトリの直下の `src`・`schemas`・`node_modules` へのリンクを作ってからビルドする | 単体テストの準備 `copyExtension` と同じ範囲 |
| 製品のコード・設計書・`docs/` | 変えない | - |
| 既存機能への影響 | `useVscodeE2E` を使う E2E を流し、拡張機能のビルドが通って各ケースが流れることを確かめる | - |
